import { IOptions, IServiceCollection, IServiceRegistration, ServiceMap } from "@tool/service-collection";

export type ModuleConstructor<T extends IModule = IModule> = { new(host?: IModuleHost): T };
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
    /** A helper function for getting an option instance from the current module settings. */
    readonly get: <T>(options: IOptions<T>, name?: string) => T;
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
    readonly key: Symbol;
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

export interface IModuleHostFactory {
    (services: ServiceMap, modules: IModule[], settings: IModuleSettingsCollection): IModuleHost;
}

// TODO: make this generic
export interface IModuleHostExtension {
    (factory: IModuleHostFactory): IModuleHostFactory;
}

/** Represents a host of loaded modules. */
export interface IModuleHost {
    /** The collection of services for the host. */
    readonly services: IServiceCollection;
    /** Gets the loaded module instance for the specified module constructor. */
    getInstance<T extends IModule>(ctor: ModuleConstructor<T>): T;
    /** Loads all the registered modules with the host. */
    load(): Promise<void>;
}

export interface IModuleHostBuilder<THost extends IModuleHost = IModuleHost> {
    build(): THost;
    configureServices(callback: (registration: IServiceRegistration) => void): this;
    useModules(modules: ModuleInstanceOrConstructor[]): this;
    useSettings(settings: IModuleSettingsCollection): this;
}

export interface ILoadModuleOptions {
    readonly extension?: IModuleHostExtension;
    readonly modules: ModuleInstanceOrConstructor[];
    readonly settings?: IModuleSettingsCollection;
}

/** Combines one or more extensions into a single extension. */
export function combineExtensions(...extensions: IModuleHostExtension[]): IModuleHostExtension {
    return extensions.reduce((accumulator, current) => factory => current(accumulator(factory)));
}

/** Creates a module configuration type used to configure a module. */
export function createConfigType<T>(key?: string): IModuleConfigurationType<T> {
    return { key: Symbol(key) };
}

/** Create a new host builder. */
export function createHostBuilder(extension?: IModuleHostExtension): IModuleHostBuilder {
    let services: ServiceMap | undefined;

    // treat these as immutable so there is no need to clone when building
    let modules: ModuleInstanceOrConstructor[] = [];
    let settings: IModuleSettingsCollection = {};

    return {
        build: () => {
            const factory = extension ? extension(createHost) : createHost;
            return factory((services && services.clone()) || new ServiceMap(), modules, settings);
        },
        configureServices: function (callback) {
            services = services || new ServiceMap();
            callback(services);
            return this;
        },
        useModules: function (m) {
            modules = [...modules, ...m];
            return this;
        },
        useSettings: function (s) {
            settings = merge(s, settings);
            return this;
        } 
    };
}

/** A helper function that will load a set of modules and return a host. */
export function loadModules(modules: ModuleInstanceOrConstructor[]): Promise<IModuleHost>
export function loadModules(options: ILoadModuleOptions): Promise<IModuleHost>;
export function loadModules(modulesOrOptions: ModuleInstanceOrConstructor[] | ILoadModuleOptions): Promise<IModuleHost> {
    const options = Array.isArray(modulesOrOptions) ? { modules: modulesOrOptions } : modulesOrOptions;
    let builder = createHostBuilder(options.extension).useModules(options.modules);

    if (options.settings) {
        builder = builder.useSettings(options.settings);
    }

    const host = builder.build();
    return host.load().then(() => host);
}

function createHost(services: ServiceMap, coreModules: IModule[], settingsCollection: IModuleSettingsCollection): IModuleHost {
    return new class {
        private readonly modules: IModule[] = [];

        readonly services = services;

        getInstance<T extends IModule>(ctor: ModuleConstructor<T>): T {
            const result = this.modules!.find(module => module instanceof ctor);
            if (!result) {
                throw new Error("Module instance not found");
            }
    
            return <T>result;
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
        load(): Promise<void> {
            if (this.modules.length) {
                return Promise.resolve();
            }

            // get all modules and sort by dependencies
            const discoveredModules = expandAndSortModules(this, coreModules);

            // initialize discovered modules
            const configs = new Map<Symbol, ConfigurationEntry>();
            discoveredModules.forEach(module => {
                if (module.initialize) {
                    module.initialize({
                        config: type => ({ 
                            register: callback => { 
                                if (configs.has(type.key)) {
                                    throw new Error(`Duplicate config ${type.key.toString()}`);
                                }

                                configs.set(type.key, { callback, module });
                            }
                        }),
                        get settings() { 
                            return {
                                bindToOptions: (options: IOptions<any>, sectionName?: string) => {
                                    services.addOptionsProvider({
                                        tryGet: (opt: IOptions<any>) => {
                                            if (options === opt) {
                                                const settings = getSettingsForModule(module, settingsCollection);
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
            for (const module of discoveredModules) {
                if (module.configureServices) {
                    module.configureServices(services);
                }
            }

            this.modules.push(...discoveredModules);
            services.freeze();

            // lastly, configure the modules
            const iterator = this.modules[Symbol.iterator]();
            const next = async () => {
                for (const module of iterator) {
                    await configure(module);
                }
            };
            const configure = (module: IModule) => module.configure && module.configure({
                services: services,
                settings: getSettingsForModule(module, settingsCollection),
                get options() { 
                    return {
                        get: (options: IOptions<any>, name?: string) => {
                            // the path to the options is expected to be: {module-name}/{options-name}
                            return getSettingsForModule(module, settingsCollection)[name || options.key];
                        }
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
                                settings: settingsCollection[item.module.name] || {}
                            });
                        }
                    };
                },
                next
            });

            // invoke the iterator to start configuring the modules
            return next();
        }
    };
}

function merge(source: any, target: any): any {
    if (isObject(source) && isObject(target)) {
        for (const key in source) {
            if (source[key] === undefined) {
                // do not merge if the source value is undefined
                continue;
            }

            target = { 
                ...target,
                [key]: isObject(source[key]) ? merge(source[key], target[key] || {}) : source[key] 
            };
        }
    }

    return target;
}

function isObject(obj: any): boolean {
    return obj && typeof obj === "object" && !Array.isArray(obj);
}

function getSettingsForModule(module: IModule, settings: IModuleSettingsCollection): any {
    return settings[module.name] || {};
}

function expandAndSortModules(host: IModuleHost, modules: ModuleInstanceOrConstructor[]): IModule[] {
    const instances = new Map<ModuleConstructor, IModule>();
    const sorted: IModule[] = [];
    const visited: { [name: string]: boolean } = {};

    const getInstance = (ctor: ModuleConstructor) => {
        let instance = instances.get(ctor);

        if (!instance) {
            instance = new ctor(host);
            instances.set(ctor, instance);
        }

        return instance;
    };

    const visit = (moduleOrCtor: ModuleInstanceOrConstructor, ancestors?: { [name: string]: boolean }) => {
        const module = typeof moduleOrCtor === "function" ? getInstance(moduleOrCtor) : moduleOrCtor;

        if (visited[module.name]) {
            return;
        }
        
        if (!ancestors) {
            ancestors = {};
        }

        if (ancestors[module.name]) {
            throw new Error(`Circular dependency has been detected with module ${module.name}`);
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

    for (const module of modules) {
        visit(module);
    }

    return sorted;
}

export class ModuleLoadError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ModuleLoadError.prototype);
    }
}