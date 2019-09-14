export type ValidateOptionsCallback<T> = (obj: T, invalid: (err: OptionsValidationError) => void) => void;
export type ValidateOptionsFailCallback = (err: OptionsValidationError) => void;

type Constructor<T> = { new(...args: any[]): T };
type NonOptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T];

/** Defines an object that supports a dispose function; scoped service instances that implement dispose will get invoked when the scoped container is cleaned up. */
export interface IDisposable {
    dispose(): void;
}

export interface IInjectable<T> {
    readonly key: string;
    readonly factory?: (services: IServiceCollection) => T;
    (...args: any[]): void;
}

export interface IInjectableOptions<T> {
    readonly key: string;
    readonly factory?: (services: IServiceCollection) => T;
}

export interface IOptions<T> extends IInjectable<T> {
    readonly defaultOptions?: T;
    readonly register: (callback: ValidateOptionsCallback<T>) => void;
    readonly require: (...props: NonOptionalKeys<T>[]) => void;
    readonly validate: (obj: T, fail: ValidateOptionsFailCallback) => boolean;
}

export interface IService<T> extends IInjectable<T> {
}

export interface IInstantiationService {
    createInstance<T>(ctor: Constructor<T>): T;
}

export interface IOptionsService {
    /** Adds an options provider to the service. */
    addOptionsProvider(provider: IOptionsProvider): void;
    /** Registers a callback that gets invoked to configure/modify an options instance when one has been requested. */
    configureOptions<T>(options: IOptions<T>, callback: (options: T) => T): void;
    /** Gets an instance of the specified options. */
    getOptions<T>(options: IOptions<T>): T;
}

export interface IOptionsProvider {
    tryGet<T>(id: IOptions<T>): T | undefined;
}

export interface IServiceRegistration {
    /** Registers a service using its required scope. Note: a service class must define a required scope decorator. */
    register<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>): void;
    /** Registers a singleton instance that lives within the collection and is available to all child scopes. Note: if the instance implements IDisposable it will not be disposed automatically. */
    registerInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance): void;
    /** Registers a service that gets created once per service collection scope. */
    registerScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void;
    /** Registers a service that gets created once and is available to all child scopes. */
    registerSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void;
    /** Registers a service that gets created each time the service is requested from a collection. */
    registerTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void;
}

export interface IServiceCollection {
    /** Creates a scoped collection. */
    createScope(): IScopedServiceCollection;
    /** Gets an instance of the registered service. */
    get<T>(serviceOrKey: IService<T> | string): T;
    /** True if a service has been registered. */
    has<T>(serviceOrKey: IService<T> | string): boolean;
    /** Gets an instance of the specified service if one has been registered or undefined if not. */
    tryGet<T>(serviceOrKey: IService<T> | string): T | undefined;
}

export interface IServiceFactory<T> {
    create(services: IServiceCollection): T;
}

export interface IScopedServiceCollection extends IServiceCollection, IDisposable {
}

interface IDependencies {
    [index: number]: IInjectable<any>;
}

interface IServiceEntry<T = any> {
    readonly service: IService<T>;
    readonly scope: ServiceScope;
    readonly ctor?: Constructor<T>;
    readonly factory?: IServiceFactory<T>;
    instance?: T;
}

export const IInstantiationService = createService<IInstantiationService>("instantiation-service");
export const IOptionsService = createService<IOptionsService>("options-service");
export const IServiceCollection = createService<IServiceCollection>("service-collection");

const dependencies = "__dependencies";
const scope = "__scope";

const enum ServiceScope {
    instance = "instance",
    scoped = "scoped",
    singleton = "singleton",
    transient = "transient"
}

/** Class decorator identifying the required scope for a service as 'scoped'. */
export function Scoped(ctor: any) {
    ctor[scope] = ServiceScope.scoped;
}

/** Class decorator identifying the required scope for a service as 'singleton'. */
export function Singleton(ctor: any) {
    ctor[scope] = ServiceScope.singleton;
}

/** Class decorator identifying the required scope for a service as 'transient'. */
export function Transient(ctor: any) {
    ctor[scope] = ServiceScope.transient;
}

export function createInjectable<T>(key: string): IInjectable<T>;
export function createInjectable<T>(options: IInjectableOptions<T>): IInjectable<T>;
export function createInjectable<T>(keyOrOptions: string | IInjectableOptions<T>): IInjectable<T> {
    const options = typeof keyOrOptions === "object" ? keyOrOptions : { key: keyOrOptions };
    const injectable = <any>function (target: any, propertyKey: string, parameterIndex: number): any {
        if (!isConstructor(target)) {
            throw new Error("An injectable decorator only supports constructor parameters.");
        }

        captureDependency(injectable, target, parameterIndex);
    };

    injectable.key = options.key;
    injectable.factory = options.factory;
    injectable.toString = () => options.key;

    return injectable;
}

export function createOptions<T>(key: string, defaultOptions?: T): IOptions<T> {
    const validation: ValidateOptionsCallback<T>[] = [];
    const options = <any>createInjectable<T>({
        key,
        factory: services => services.get(IOptionsService).getOptions(options)
    });

    options.defaultOptions = defaultOptions;
    options.register = (callback: ValidateOptionsCallback<T>) => validation.push(callback);
    options.require = (...props: NonOptionalKeys<T>[]) => {
        (<IOptions<T>>options).register((obj, invalid) => {
            for (const prop of props) {
                if (obj[prop] === undefined) {
                    invalid(new OptionsValidationError(`Options (${key}) property (${prop}) is required.`));
                    break;
                }
            }
        });
    };
    options.validate = (obj: T, fail: ValidateOptionsFailCallback): boolean => {
        let error: OptionsValidationError | undefined;
        for (let i = 0; i < validation.length && error === undefined; i++) {
            validation[i](obj, err => error = err);
        }

        if (error) {
            fail(error);
        }

        return error === undefined;
    };

    return options;
}

export function createService<T>(key: string): IService<T> {
    return createInjectable<T>(key);
}

function getDependencies(ctor: any): IDependencies {
    return ctor[dependencies] || {};
}

function getServiceScope(ctor: any): ServiceScope {
    const value = ctor[scope];
    
    if (!value) {
        throw new Error(`Default scope not defined for service (${ctor.name})`);
    }

    return value;
}

function captureDependency<T>(injectable: IInjectable<T>, target: any, index: number): void {
    target[dependencies] = target[dependencies] || {};
    target[dependencies][index] = injectable;
}

function isConstructor<T>(target: any): target is Constructor<T> {
    return typeof target === "function" && target === target.prototype.constructor;
}

function isDisposable(obj: any): obj is IDisposable {
    return (<IDisposable>obj).dispose !== undefined;
}

function isServiceFactory<T>(target: any): target is IServiceFactory<T> {
    return typeof target === "object" && (<IServiceFactory<T>>target).create !== undefined;
}

/** Represents an error that has occurred while trying to create an object instance. */
export class ObjectCreateError extends Error {
    constructor(message: string, readonly inner: Error) {
        super(message);
        Object.setPrototypeOf(this, ObjectCreateError.prototype);
    }
}

/** 
 *  A service factory that will create a single instance and return the same instance everytime create is invoked.
 *  This is useful for singleton services that implement multiple service interfaces.
 */
export class SingletonServiceFactory<T> implements IServiceFactory<T> {
    private instance?: T;

    constructor(private readonly ctorOrFactory: Constructor<T> | IServiceFactory<T>) {
    }

    create(services: IServiceCollection): T {
        if (!this.instance) {
            this.instance = isServiceFactory(this.ctorOrFactory)
                ? this.ctorOrFactory.create(services)
                : services.get(IInstantiationService).createInstance(this.ctorOrFactory);
        }

        return this.instance;
    }
}

export class ServiceMap implements IServiceRegistration, IServiceCollection, IOptionsService, IInstantiationService {
    private readonly services = new Map<string, IServiceEntry>();
    private isFrozen?: boolean;

    constructor() {
        // the thisFactory is necessary for scoped collections
        const thisFactory = { create: () => this };
        this.registerService(IInstantiationService, ServiceScope.scoped, thisFactory);
        this.registerService(IServiceCollection, ServiceScope.scoped, thisFactory);
        this.registerSingleton(IOptionsService, OptionsService);
    }

    addOptionsProvider(provider: IOptionsProvider): void {
        return this.get(IOptionsService).addOptionsProvider(provider);
    }

    configureOptions<T>(options: IOptions<T>, callback: (options: T) => T): void {
        this.get(IOptionsService).configureOptions(options, callback);
    }

    createInstance<T>(ctor: Constructor<T>): T {
        return this.createObjectInstance(ctor);
    }

    createScope(): IScopedServiceCollection {
        const parent = this;
        return new class extends ServiceMap implements IDisposable {
            constructor() {
                super();

                // The service map registers a few built-in services that need to be handled a little differently
                // -- if the service is singleton/instance it gets copied from the parent
                // -- if the service is scoped/transient do not overwrite the entry from the parent

                for (const entry of parent.services.values()) {
                    if (entry.scope === ServiceScope.singleton || entry.scope === ServiceScope.instance) {
                        // copy the singleton entry directly to the scoped collection - it's possible the instance has not yet been created so the entire entry gets copied down
                        this.registerEntry(entry);
                    }
                    else if (!this.services.has(entry.service.key)) {
                        // create a new entry for scoped/transient services
                        this.registerEntry({ ...entry, instance: undefined })
                    }
                }

                this.freeze();
            }

            dispose(): void {
                for (const service of this.services.values()) {
                    // only dispose scoped service instances that were instantiated by the current service scope
                    if (service.instance &&
                        service.scope === ServiceScope.scoped &&
                        isDisposable(service.instance)) {
                        service.instance.dispose();
                    }
                }

                this.services.clear();
            }
        }
    }

    getOptions<T>(options: IOptions<T>): T {
        return this.get(IOptionsService).getOptions(options);
    }

    register<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>): void {
        this.registerService(service, getServiceScope(ctor), ctor);
    }

    registerInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance): void {
        if (instance === undefined) {
            throw new Error("instance undefined");
        }

        // TODO: check if the instance constructor has a required scope - if so, verify its a singleton

        this.services.set(service.key, {
            service,
            scope: ServiceScope.instance,
            instance
        });
    }

    registerScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void {
        this.registerService(service, ServiceScope.scoped, ctorOrFactory);
    }

    registerSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void {
        this.registerService(service, ServiceScope.singleton, ctorOrFactory);
    }

    registerTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>): void {
        this.registerService(service, ServiceScope.transient, ctorOrFactory);
    }

    get<T>(serviceOrKey: IService<T> | string): T {
        const key = typeof serviceOrKey === "string" ? serviceOrKey : serviceOrKey.key;
        return this.getOrCreateServiceInstance(key);
    }

    has<T>(serviceOrKey: IService<T> | string): boolean {
        const key = typeof serviceOrKey === "string" ? serviceOrKey : serviceOrKey.key;
        return this.services.has(key);
    }

    tryGet<T>(serviceOrKey: IService<T> | string): T | undefined {
        if (this.has(serviceOrKey)) {
            return this.get(serviceOrKey);
        }

        return undefined;
    }

    /** Prevents items from being registered with the serivce map. */
    freeze(): void {
        this.isFrozen = true;
    }

    private registerService(service: IService<any>, scope: ServiceScope, ctorOrFactory: Constructor<any> | IServiceFactory<any>): void {
        this.registerEntry({
            service,
            scope,
            ctor: isConstructor(ctorOrFactory) ? ctorOrFactory : undefined,
            factory: isServiceFactory(ctorOrFactory)  ? ctorOrFactory : undefined
        });
    }

    private registerEntry(entry: IServiceEntry): void {
        if (this.isFrozen === true) {
            throw new Error("Service collection is frozen");
        }

        if (entry.ctor) {
            this.checkInstanceScope(entry.ctor, entry.scope);
        }

        this.services.set(entry.service.key, entry);
    }

    private checkFactoryInstance(instance: any, scope: ServiceScope): void {
        if (typeof instance !== "object") {
            throw new Error("Instance must be an object");
        }

        if (instance.constructor !== Object) {
            this.checkInstanceScope(instance.constructor, scope);
        }
    }

    private checkInstanceScope(ctor: Constructor<any>, scope: ServiceScope): void {
        const requiredScope: ServiceScope | undefined = (<any>ctor)[scope];
        if (requiredScope && requiredScope !== scope) {
            throw new Error("Registered service scope is different than the instance required scope");
        }
    }

    private getOrCreateServiceInstance(key: string, ancestors?: Constructor<any>[]): any {
        const entry = this.services.get(key);

        if (!entry) {
            throw new Error(`Service not registered for key '${key}'.`);
        }

        if (entry.instance) {
            return entry.instance;
        }

        const instance = this.createServiceInstance(entry, ancestors);
        if (entry.scope === ServiceScope.scoped || entry.scope === ServiceScope.singleton) {
            entry.instance = instance;
        }

        return instance;
    }

    private getOrCreateInjectable<T>(injectable: IInjectable<T>, ancestors?: Constructor<any>[]): T {
        if (this.services.has(injectable.key)) {
            return this.getOrCreateServiceInstance(injectable.key, ancestors);
        }

        if (injectable.factory) {
            return injectable.factory(this);
        }

        throw new Error(`Invalid injectable (${injectable.key}), custom injectables must define a factory.`);
    }

    private createServiceInstance<T>(entry: IServiceEntry<T>, ancestors?: Constructor<any>[]): T {
        if (entry.factory) {
            const instance = entry.factory.create(this);
            // even though the scope cannot be verified until now it is still a good idea to check that the service instance is being properly scoped
            this.checkFactoryInstance(instance, entry.scope);
            return instance;
        }

        if (entry.ctor) {
            return this.createObjectInstance(entry.ctor, ancestors);
        }

        throw new Error("Invalid service entry.");
    }

    private createObjectInstance<T>(ctor: Constructor<T>, ancestors?: Constructor<any>[]): T {
        if (ancestors && ancestors.includes(ctor)) {
            const path = [...ancestors.map(ctor => ctor.name), ctor.name].join(" -> ");
            throw new Error("Circular dependency detected: " + path);
        }

        const dependencies = getDependencies(ctor);
        const keys = Object.keys(dependencies);

        if (ctor.length > keys.length) {
            throw new Error(`Invalid constructor (${ctor.name}), all parameters must be injectable.`);
        }

        try {
            ancestors = ancestors || [];
            ancestors.push(ctor);

            // create/get instances for all the object's constructor parameters
            const args = keys.map(key => this.getOrCreateInjectable(dependencies[<any>key], ancestors));

            ancestors.splice(ancestors.indexOf(ctor), 1);

            return new ctor(...args);
        }
        catch (err) {
            throw new ObjectCreateError(`Failed to get dependencies for Constructor (${ctor.name}): ${err.message}`, err);
        }
    }
}

/** Represents an error for an options object instance that failed validation. */
export class OptionsValidationError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, OptionsValidationError.prototype);
    }
}

class OptionsService implements IOptionsService {
    private readonly options = new Map<string, (options: any) => any>();
    private readonly providers: IOptionsProvider[] = [];

    addOptionsProvider(provider: IOptionsProvider): void {
        this.providers.unshift(provider);
    }
    
    configureOptions<T>(options: IOptions<T>, callback: (options: T) => T): void {
        const configure = this.options.get(options.key);
        this.options.set(options.key, options => callback(configure ? configure(options) : options));
    }
    
    getOptions<T>(options: IOptions<T>): T {
        let result: T | undefined;
        for (const provider of this.providers) {
            const instance = provider.tryGet(options);
            if (instance) {
                result = instance;
                break;
            }
        }

        result = this.mergeWithDefaultOptions(result || {}, options.defaultOptions);

        const configure = this.options.get(options.key);
        result = configure ? configure(result) : result;

        let error: OptionsValidationError | undefined;
        if (!options.validate(result!, err => error = err)) {
            throw error;
        }

        return result!;
    }

    private mergeWithDefaultOptions(options: any, defaultOptions: any): any {
        // this allows supporting partial options and will handle merging in any default values that were omitted
        if (defaultOptions) {
            // clone the options object and return a merged options instance
            options = { ...options };
            Object.keys(defaultOptions).forEach(key => {
                if (options[key] === undefined) {
                    options[key] = defaultOptions[key];
                }
            });
        }

        return options;
    }
}