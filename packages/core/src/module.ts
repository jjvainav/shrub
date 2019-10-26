import { IOptions, IServiceCollection, IServiceRegistration, ServiceMap } from "./service-collection";

export type ModuleConstructor<T extends IModule = IModule> = { new(): T };
export type ModuleInstanceOrConstructor = IModule | ModuleConstructor;

export type SettingsInitializer = {
    /** 
     * Binds module settings to an options object; the options object gets bound to the settings path {module-name} or {module-name}/{section-name}.
     * The section name parameter is optional and useful for binding to a section of the module's settings.
     */
    readonly bindToOptions: <T>(options: IOptions<T>, sectionName?: string) => void;
};

type ConfigurationInitializer<T> = {
    readonly register: (callback: (configurator: IModuleConfigurator) => T) => void;
};

type ConfigurationEntry = {
    readonly callback: (configurator: IModuleConfigurator) => any;
    readonly module: IModule;
};

type OptionsProvider = {
    /** 
     * A helper function for getting an option instance from the current module settings. 
     * It's expected that the module also use bindToOptions to bind to the module's settings.
     */
    readonly get: <T>(options: IOptions<T>) => T;
};

/** A collection of settings for one or more module keyed by the module name. */
export interface IModuleSettingsCollection {
    readonly [name: string]: IModuleSettings | undefined;
}

/** A set of key/value settings for a single module. */
export interface IModuleSettings {
    readonly [key: string]: any;
}

export interface IModule {
    readonly name: string;
    readonly dependencies?: ModuleInstanceOrConstructor[];
    initialize?(init: IModuleInitializer): void;
    configureServices?(registration: IServiceRegistration): void;
    configure?(configurator: IModuleConfigurator): void | Promise<void>;
}

export interface IModuleConfigurationType<T> {
    readonly key: symbol;
}

export interface IModuleConfiguration {
    get<T>(type: IModuleConfigurationType<T>): T;
}

export interface IModuleConfigurator {
    readonly config: IModuleConfiguration;
    readonly options: OptionsProvider;
    readonly services: IServiceCollection;
    readonly settings: IModuleSettings;
    readonly next: () => Promise<void>;
}

export interface IModuleInitializer {
    /** Gets a configuration initializer for a module configuration type. */
    config<T>(type: IModuleConfigurationType<T>): ConfigurationInitializer<T>;
    /** Gets a settings initializer for the current module. */
    settings: SettingsInitializer;
}

/** A collection of loaded modules. */
export interface IModuleCollection {
    /** The collection of services for the host. */
    readonly services: IServiceCollection;
    /** Gets the loaded module instance for the specified module constructor. */
    getInstance<T extends IModule>(ctor: ModuleConstructor<T>): T;
}

export interface ILoadOptions {
    readonly modules: ModuleInstanceOrConstructor[];
    readonly settings?: IModuleSettingsCollection;
}

/** Creates a module configuration used to configure a module. */
export function createConfig<T>(): IModuleConfigurationType<T> {
    return { key: Symbol() };
}

export class ModuleLoadError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ModuleLoadError.prototype);
    }
}

/** Handles initializing and loading modules. */
export class ModuleLoader {
    private readonly services = new ServiceMap();
    private readonly modules: ModuleInstanceOrConstructor[] = [];
    private settings: IModuleSettingsCollection = {};
    private isLoaded?: boolean;

    static load(modules: ModuleInstanceOrConstructor[]): Promise<IModuleCollection>
    static load(options: ILoadOptions): Promise<IModuleCollection>;
    static load(modulesOrOptions: ModuleInstanceOrConstructor[] | ILoadOptions): Promise<IModuleCollection> {
        const options = Array.isArray(modulesOrOptions) ? { modules: modulesOrOptions } : modulesOrOptions;
        const loader = new ModuleLoader();

        if (options.settings) {
            loader.useSettings(options.settings);
        }

        return loader.useModules(options.modules).load();
    }

    static configureServices(callback: (registration: IServiceRegistration) => void): ModuleLoader {
        return new ModuleLoader().configureServices(callback);
    }

    static useModules(modules: ModuleInstanceOrConstructor[]): ModuleLoader {
        return new ModuleLoader().useModules(modules);
    }

    static useSettings(settings: IModuleSettingsCollection): ModuleLoader {
        return new ModuleLoader().useSettings(settings);
    }

    /**
     * Loads the specified core modules into the manager. The load operation will discover
     * the core module dependencies and then initialize/configure each module.
     * 
     * This will first discover all dependent modules, create module instances, and sort the 
     * list of discovered modules by dependency (note: there is no guarantee of the order when creating 
     * module instances but each step against the discovered modules will execute against module dependents first).
     * 
     * Module Steps:
     * 
     * 1) Initialize
     * 2) Configure Services 
     * 3) Configure
     */   
    load(): Promise<IModuleCollection> {
        this.ensureNotLoaded();
        this.isLoaded = true;

        // get all modules and sort by dependencies
        const loadedModules = this.expandAndSortModules();

        // initialize discovered modules
        const loader = this;
        const configs = new Map<symbol, ConfigurationEntry>();
        loadedModules.forEach(module => {
            if (module.initialize) {
                module.initialize({
                    config: type => ({ 
                        register: callback => configs.set(type.key, { callback, module })
                    }),
                    get settings() { 
                        return {
                            bindToOptions: (options: IOptions<any>, sectionName?: string) => {
                                loader.services.addOptionsProvider({
                                    tryGet: (opt: IOptions<any>) => {
                                        if (options === opt) {
                                            const settings = loader.getSettingsForModule(module);
                                            return sectionName ? settings[sectionName] : settings;
                                        }

                                        return undefined;
                                    }
                                });
                            }
                        };
                    }
                });
            }
        });

        // configure the module services
        for (const module of loadedModules) {
            if (module.configureServices) {
                module.configureServices(this.services);
            }
        }

        this.services.freeze();

        // lastly, configure the modules
        const iterator = loadedModules[Symbol.iterator]();
        const next = async () => {
            for (const module of iterator) {
                await configure(module);
            }
        };
        const self = this;
        const configure = (module: IModule) => module.configure && module.configure({
            services: this.services,
            settings: this.getSettingsForModule(module),
            get options() { 
                return {
                    get: (options: IOptions<any>) => self.services.getOptions(options)
                };
            },
            get config() {
                return {
                    get: <T>(type: IModuleConfigurationType<T>): T => {
                        const item = configs.get(type.key);

                        if (!item) {
                            throw new Error(`Config ${type.key.toString()} not found`);
                        }

                        return item.callback({
                            ...this,
                            // need to grab the module's settings that is being configured
                            settings: loader.getSettingsForModule(item.module)
                        });
                    }
                };
            },
            next
        });

        // invoke the iterator to start configuring the modules
        return next().then(() => ({
            services: this.services,
            getInstance: <T extends IModule>(ctor: ModuleConstructor<T>) => {
                const result = loadedModules.find(module => module instanceof ctor);
                if (!result) {
                    throw new Error("Module instance not found");
                }
        
                return <T>result;
            }
        }));
    }

    configureServices(callback: (registration: IServiceRegistration) => void): this {
        this.ensureNotLoaded();
        callback(this.services);
        return this;
    }

    useModules(modules: ModuleInstanceOrConstructor[]): this {
        this.ensureNotLoaded();
        this.modules.push(...modules);
        return this;
    }

    useSettings(settings: IModuleSettingsCollection): this {
        this.ensureNotLoaded();
        this.settings = this.merge(settings, this.settings);
        return this;
    }

    private ensureNotLoaded(): void {
        if (this.isLoaded) {
            throw new Error("Modules have already been loaded.");
        }
    }

    private getSettingsForModule(module: IModule): any {
        return this.settings[module.name] || {};
    }

    private expandAndSortModules(): IModule[] {
        const instances = new Map<ModuleConstructor, IModule>();
        const sorted: IModule[] = [];
        const visited: { [name: string]: boolean } = {};
    
        const getInstance = (moduleOrCtor: ModuleInstanceOrConstructor) => {
            if (typeof moduleOrCtor === "function") {
                const ctor = moduleOrCtor;
                let instance = instances.get(ctor);
        
                if (!instance) {
                    instance = new ctor();
                    instances.set(ctor, instance);
                }
        
                return instance;
            }

            if (typeof moduleOrCtor === "object") {
                const instance = moduleOrCtor;
                const ctor = <ModuleConstructor<IModule>>moduleOrCtor.constructor;

                if (ctor !== Object.prototype.constructor) {
                    if (instances.has(ctor)) {
                        throw new ModuleLoadError(`Duplicate module instances ${instance.name}.`);
                    }

                    instances.set(ctor, instance);
                }

                return instance;
            }

            throw new ModuleLoadError(`Invalid type (${typeof moduleOrCtor}).`);
        };
    
        const visit = (moduleOrCtor: ModuleInstanceOrConstructor, ancestors?: { [name: string]: boolean }) => {
            const module = getInstance(moduleOrCtor);
    
            if (visited[module.name]) {
                return;
            }
            
            if (!ancestors) {
                ancestors = {};
            }
    
            if (ancestors[module.name]) {
                throw new ModuleLoadError(`Circular dependency has been detected with module ${module.name}`);
            }
    
            ancestors[module.name] = true;
    
            if (module.dependencies) {
                for (const dependency of module.dependencies) {
                    visit(dependency, ancestors);
                }
            }
    
            visited[module.name] = true;
    
            // this performs a depth-first topological sort but instead of inserting
            // to the front, push the module to the back of the list so that dependencies
            // come first
            sorted.push(module);
        };
    
        for (const module of this.modules) {
            visit(module);
        }
    
        return sorted;
    }

    private merge(source: any, target: any): any {
        if (this.isObject(source) && this.isObject(target)) {
            for (const key in source) {
                if (source[key] === undefined) {
                    // do not merge if the source value is undefined
                    continue;
                }
    
                target = { 
                    ...target,
                    [key]: this.isObject(source[key]) ? this.merge(source[key], target[key] || {}) : source[key] 
                };
            }
        }
    
        return target;
    }
    
    private isObject(obj: any): boolean {
        return obj && typeof obj === "object" && !Array.isArray(obj);
    }
}