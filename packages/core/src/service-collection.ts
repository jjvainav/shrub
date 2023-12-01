export type ValidateOptionsCallback<T> = (obj: T, invalid: (err: OptionsValidationError) => void) => void;
export type ValidateOptionsFailCallback = (err: OptionsValidationError) => void;

type Constructor<T> = { new(...args: any[]): T };
type Mutable<T> = { -readonly[P in keyof T]: T[P] };
type NonOptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T];
type RegistrationResult = "success" | "frozen" | "sealed";

/** Defines an object that supports a dispose function; scoped service instances that implement dispose will get invoked when the scoped container is cleaned up. */
export interface IDisposable {
    dispose(): void;
}

export interface IInjectable<T> {
    readonly key: string;
    readonly isConfigurable: boolean;
    readonly ctor?: Constructor<T>;
    readonly factory?: (services: IServiceCollection) => T;
    configure(options: IInjectableConfigureOptions<T>): void;
    (...args: any[]): void;
}

/** Defines configurable options for an injectable object. */
export interface IInjectableConfigureOptions<T> {
    /** A constructor for a concrete class that will be created when injected. */
    readonly ctor?: Constructor<T>;
    /** A factory function responsible for creating an instances of the injectable. */
    readonly factory?: (services: IServiceCollection) => T;
}

/** Defines options for creating an injectable object. */
export interface IInjectableOptions<T> extends IInjectableConfigureOptions<T> {
    /** A unique key for the injectable. */
    readonly key: string;
    /** True if the ctor or factory for the injectable may be changed; the default is false. */
    readonly configurable?: boolean;
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
    /** Creates an object instance for the specified constructor and injects injectable constructor parameters. */
    createInstance<T>(ctor: Constructor<T>): T;
    /** Creates an object instance for the specified injectable; note: service instances cannot be created via this function and must be accessed via the service collection. */
    createInstance<T>(injectable: IInjectable<T>): T;
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

/** Defines options when registering a service. */
export interface IServiceRegistrationOptions {
    /** True if the service entry cannot be overriden; the default is false. */
    readonly sealed?: boolean;
}

export interface IServiceRegistration {
    /** Registers a service using its required scope. Note: a service class must define a required scope decorator. */
    register<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>, options?: IServiceRegistrationOptions): void;
    /** Registers a singleton instance that lives within the collection and is available to all child scopes. Note: if the instance implements IDisposable it will not be disposed automatically. */
    registerInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance, options?: IServiceRegistrationOptions): void;
    /** Registers a service that gets created once per service collection scope. */
    registerScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void;
    /** Registers a service that gets created once and is available to all child scopes. */
    registerSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void;
    /** Registers a service that gets created each time the service is requested from a collection. */
    registerTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void;
    /** Attempts to register a service using its required scope but only if a service has not already been registered. Note: a service class must define a required scope decorator. */
    tryRegister<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>, options?: IServiceRegistrationOptions): boolean;
    /** Attempts to register a singleton instance that lives within the collection and is available to all child scopes. Note: if the instance implements IDisposable it will not be disposed automatically. */
    tryRegisterInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance, options?: IServiceRegistrationOptions): boolean;
    /** Attempts to register a service that gets created once per service collection scope. */
    tryRegisterScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean;
    /** Attempts to register a service that gets created once and is available to all child scopes. */
    tryRegisterSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean;
    /** Attempts to register a service that gets created each time the service is requested from a collection. */
    tryRegisterTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean;
}

export interface IServiceCollection {
    /** 
     * Creates a scoped collection and optionally allows registering services into the scoped service collection.
     * Note: overwriting existing services are not allowed with scoped service collections.
     */
    createScope(register?: (registration: IServiceRegistration) => void): IScopedServiceCollection;
    /** Creates a scoped service map that can be used for registering and providing scoped services to the current service collection. */
    createScopeMap(): ScopedServiceMap;
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
    readonly sealed?: boolean;
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
    const injectable: Mutable<IInjectable<T>> = <any>function (target: any, propertyKey: string, parameterIndex: number): any {
        if (!isConstructor(target)) {
            throw new Error("An injectable decorator only supports constructor parameters.");
        }

        captureDependency(<IInjectable<T>>injectable, target, parameterIndex);
    };

    injectable.key = options.key;
    injectable.isConfigurable = !!options.configurable;
    injectable.ctor = options.ctor;
    injectable.factory = options.factory;
    injectable.toString = () => options.key;

    injectable.configure = function (options: IInjectableConfigureOptions<T>): void {
        if (!this.isConfigurable) {
            throw new Error("Injectable is not configurable.");
        }

        this.ctor = options.ctor
        this.factory = options.factory;
    }

    return <IInjectable<T>>injectable;
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
                    invalid(new OptionsValidationError(`Options (${key}) property (${String(prop)}) is required.`));
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

function isInjectable<T>(target: any): target is IInjectable<T> {
    return typeof target === "function" && target.key !== undefined && target.configure !== undefined;
}

function isServiceFactory<T>(target: any): target is IServiceFactory<T> {
    return typeof target === "object" && (<IServiceFactory<T>>target).create !== undefined;
}

/** Represents an error that has occurred while trying to create an object instance. */
export class ObjectCreateError extends Error {
    constructor(message: string, readonly inner?: Error) {
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
    protected readonly services: Map<string, IServiceEntry>;
    protected readonly instances = new Map<string, any>();
    
    protected isFrozen = false;
    protected isScoped = false;

    /** Creates a new ServiceMap instance with an optional parent if the ServiceMap should be scoped; note: this is used for internal purposes and should not be used directly. */
    constructor(parent?: ServiceMap) { 
        this.isScoped = !!parent;
        this.services = new Map<string, IServiceEntry>(parent?.services);

        if (!parent) {
            // the thisFactory is used to return the appropriate ServiceMap instance since the IInstantiationService and IServiceCollection services need to be scoped
            const thisFactory: IServiceFactory<IServiceCollection> = { create: service => service };
            this.registerService(IInstantiationService, ServiceScope.scoped, thisFactory, { sealed: true });
            this.registerService(IServiceCollection, ServiceScope.scoped, thisFactory, { sealed: true });
            this.registerSingleton(IOptionsService, OptionsService, { sealed: true });
        }
    }

    addOptionsProvider(provider: IOptionsProvider): void {
        return this.get(IOptionsService).addOptionsProvider(provider);
    }

    configureOptions<T>(options: IOptions<T>, callback: (options: T) => T): void {
        this.get(IOptionsService).configureOptions(options, callback);
    }

    createInstance<T>(ctorOrInjectable: Constructor<T> | IInjectable<T>): T {
        return isInjectable(ctorOrInjectable)
            ? this.createInjectableInstance(ctorOrInjectable)
            : this.createObjectInstance(ctorOrInjectable);
    }

    createScope(register?: (registration: IServiceRegistration) => void): IScopedServiceCollection {
        const scopedServices = this.createScopeMap();

        if (register) {
            register(scopedServices);
        }

        scopedServices.freeze();
        return scopedServices;
    }

    createScopeMap(): ScopedServiceMap {
        return new ScopedServiceMap(this);
    }

    getOptions<T>(options: IOptions<T>): T {
        return this.get(IOptionsService).getOptions(options);
    }

    register<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>, options?: IServiceRegistrationOptions): void {
        this.registerService(service, getServiceScope(ctor), ctor, options);
    }

    registerInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance, options?: IServiceRegistrationOptions): void {
        if (instance === undefined) {
            throw new Error("instance undefined");
        }

        if (this.isScoped && this.services.has(service.key)) {
            throw new Error(`Service with key (${service.key}) cannot be overridden.`);
        }

        // TODO: check if the instance constructor has a required scope - if so, verify its a singleton

        this.instances.set(service.key, instance);
        this.services.set(service.key, { service, scope: ServiceScope.instance, sealed: options && options.sealed });
    }

    registerScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void {
        this.registerService(service, ServiceScope.scoped, ctorOrFactory, options);
    }

    registerSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void {
        this.registerService(service, ServiceScope.singleton, ctorOrFactory, options);
    }

    registerTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): void {
        this.registerService(service, ServiceScope.transient, ctorOrFactory, options);
    }

    tryRegister<T, TInstance extends T>(service: IService<T>, ctor: Constructor<TInstance>, options?: IServiceRegistrationOptions): boolean {
        return this.tryRegisterService(service, getServiceScope(ctor), ctor, options) === "success";
    }

    tryRegisterInstance<T, TInstance extends T>(service: IService<T>, instance: TInstance, options?: IServiceRegistrationOptions): boolean{
        try {
            // TODO: refactor -- need to invoke registerInstance because it registers the instance
            this.registerInstance(service, instance, options);
            return true;
        }
        catch {
            return false;
        }
    }

    tryRegisterScoped<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean{
        return this.tryRegisterService(service, ServiceScope.scoped, ctorOrFactory, options) === "success";
    }

    tryRegisterSingleton<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean{
        return this.tryRegisterService(service, ServiceScope.singleton, ctorOrFactory, options) === "success";
    }

    tryRegisterTransient<T, TInstance extends T>(service: IService<T>, ctorOrFactory: Constructor<TInstance> | IServiceFactory<TInstance>, options?: IServiceRegistrationOptions): boolean{
        return this.tryRegisterService(service, ServiceScope.transient, ctorOrFactory, options) === "success";
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
            // still need a try/catch incase one of the services dependencies fails to load
            try {
                return this.get(serviceOrKey);
            }
            catch {}
        }

        return undefined;
    }

    /** Prevents items from being registered with the serivce map. */
    freeze(): void {
        this.isFrozen = true;
    }

    /** @internal */
    getOrCreateServiceInstance(key: string, rootScope?: ServiceScope, ancestors?: Constructor<any>[]): any {
        const entry = this.services.get(key);

        if (!entry) {
            throw new Error(`Service not registered for key '${key}'.`);
        }

        let current = this.instances.get(key);
        if (current) {
            return current;
        }

        const instance = this.createServiceInstance(entry, rootScope, ancestors);
        if (entry.scope === ServiceScope.scoped || entry.scope === ServiceScope.singleton) {
            this.instances.set(key, instance);
        }

        return instance;
    }

    private registerService(service: IService<any>, scope: ServiceScope, ctorOrFactory: Constructor<any> | IServiceFactory<any>, options?: IServiceRegistrationOptions): void {
        const result = this.tryRegisterService(service, scope, ctorOrFactory, options);

        if (result === "frozen") {
            throw new Error("Service collection is frozen");
        }

        if (result === "sealed") {
            throw new Error(`Service with key (${service.key}) cannot be overridden.`);
        }
    }

    private tryRegisterService(service: IService<any>, scope: ServiceScope, ctorOrFactory: Constructor<any> | IServiceFactory<any>, options?: IServiceRegistrationOptions): RegistrationResult {
        if (this.isFrozen === true) {
            return "frozen";
        }

        const current = this.services.get(service.key);
        if (current && (current.sealed || this.isScoped)) {
            return "sealed";
        }

        const ctor = isConstructor(ctorOrFactory) ? ctorOrFactory : undefined;
        const factory = isServiceFactory(ctorOrFactory)  ? ctorOrFactory : undefined;
        const sealed = options && options.sealed;
        
        if (ctor) {
            this.checkInstanceScope(ctor, scope);
        }

        this.services.set(service.key, { service, scope, ctor, factory, sealed });
        return "success";
    }

    private checkFactoryInstance(instance: any, scope: ServiceScope): void {
        if (typeof instance !== "object" && typeof instance !== "function") {
            throw new Error("Instance must be an object or function");
        }

        if (instance.constructor !== Object && instance.constructor !== Function) {
            this.checkInstanceScope(instance.constructor, scope);
        }
    }

    private checkInstanceScope(ctor: Constructor<any>, scope: ServiceScope): void {
        const requiredScope: ServiceScope | undefined = (<any>ctor)[scope];
        if (requiredScope && requiredScope !== scope) {
            throw new Error("Registered service scope is different than the instance required scope");
        }
    }

    private checkParentChildScopes(parentScope: ServiceScope | undefined, childScope: ServiceScope | undefined, childKey: string): void {
        if (!parentScope || parentScope === ServiceScope.instance || parentScope === ServiceScope.singleton) {
            if (childScope === ServiceScope.scoped) {
                throw new Error(`Scoped service (${childKey}) should only be referenced by a Transient or Scoped service.`);
            }
        }
    }

    private getOrCreateInjectable<T>(injectable: IInjectable<T>, rootScope?: ServiceScope, ancestors?: Constructor<any>[]): T {
        return this.services.has(injectable.key)
            ? this.getOrCreateServiceInstance(injectable.key, rootScope, ancestors)
            : this.createInjectableInstance(injectable);
    }

    private createInjectableInstance<T>(injectable: IInjectable<T>): T {
        if (injectable.factory) {
            return injectable.factory(this);
        }

        if (injectable.ctor) {
            return this.createInstance(injectable.ctor);
        }

        throw new Error(`Invalid injectable (${injectable.key}), the injectable must define a factory or constructor.`);
    }

    private createServiceInstance<T>(entry: IServiceEntry<T>, rootScope?: ServiceScope, ancestors?: Constructor<any>[]): T {
        if (entry.factory) {
            const instance = entry.factory.create(this);
            // even though the scope cannot be verified until now it is still a good idea to check that the service instance is being properly scoped
            this.checkFactoryInstance(instance, entry.scope);
            return instance;
        }

        if (entry.ctor) {
            return this.createObjectInstance(entry.ctor, rootScope, ancestors);
        }

        throw new Error("Invalid service entry.");
    }

    private createObjectInstance<T>(ctor: Constructor<T>, rootScope?: ServiceScope, ancestors?: Constructor<any>[]): T {
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
            // root scope is used to ensure service dependecies are properly scoped -- mainly, singleton services should not reference scoped services
            rootScope = rootScope || (<any>ctor)[scope];
 
            // ancestors is used to track circular dependencies
            ancestors = ancestors || [];
            ancestors.push(ctor);

            // create/get instances for all the object's constructor parameters
            const args = keys.map(key => {
                const injectable = dependencies[<any>key];
                const entry = this.services.get(injectable.key);
                this.checkParentChildScopes(rootScope, entry && entry.scope, injectable.key);
                return this.getOrCreateInjectable(injectable, rootScope, ancestors);
            });

            ancestors.splice(ancestors.indexOf(ctor), 1);

            return new ctor(...args);
        }
        catch (err) {
            if (err instanceof Error) {
                throw new ObjectCreateError(`Failed to get dependencies for Constructor (${ctor.name}): ${err.message}`, err);
            }

            throw new ObjectCreateError(`Failed to get dependencies for Constructor (${ctor.name}): ${err}`);
        }
    }
}

export class ScopedServiceMap extends ServiceMap implements IScopedServiceCollection {
    constructor(private readonly parent: ServiceMap) {
        super(parent);
    }

    dispose(): void {
        for (const instance of this.instances.values()) {
            // dispose instances created and referenced by the scope; this will be scoped and transient instances
            // also make sure we don't dispose the current instance as that will cause a stack overflow
            if (instance !== this && isDisposable(instance)) {
                instance.dispose();
            }
        }

        this.instances.clear();
    }

    getOrCreateServiceInstance(key: string, rootScope?: ServiceScope, ancestors?: Constructor<any>[]): any {
        // if the service is registered direclty with the scoped service collection the parent collection will not be aware so check that first
        if (this.parent.has(key)) {
            const entry = this.services.get(key);
            if (entry !== undefined && (entry.scope === ServiceScope.singleton || entry.scope === ServiceScope.instance)) {
                // if the service is a singleton or instance call up the parent chain to get the instance
                return this.parent.getOrCreateServiceInstance(key, rootScope, ancestors);
            }
        }

        return super.getOrCreateServiceInstance(key, rootScope, ancestors);
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