import { 
    createOptions, createService, IDisposable, IInstantiationService, IServiceCollection,
    OptionsValidationError, Scoped, ServiceMap, Singleton, SingletonServiceFactory 
} from "../src/service-collection";

const IFooService = createService<IFooService>("foo-service");
const IBarService = createService<IBarService>("bar-service");
const ICircular1Service = createService<ICircular1Service>("circular1-service");
const ICircular2Service = createService<ICircular2Service>("circular2-service");
const ICircular3Service = createService<ICircular3Service>("circular3-service");
const ICompositeService = createService<ICompositeService>("composite-service");
const ICompositeService2 = createService<ICompositeService>("composite-service2");
const ISingletonService = createService<ISingletonService>("singleton-service");
const ITestService = createService<ITestService>("test-service");

const IChildScopedService = createService<IChildScopedService>("child-scoped-service");
const IParentSingletonService = createService<IParentSingletonService>("parent-singleton-service");

const ITestOptions = createOptions<ITestOptions>("test", { 
    foo: "default-foo",
    bar: "default-bar"
});
const ITestServiceWithOptions = createService<ITestServiceWithOptions>("test-service-with-options");

const ITestOptionsWithValidation = createOptions<ITestOptionsWithValidation>("test-with-validation");
ITestOptionsWithValidation.require("foo", "bar");
ITestOptionsWithValidation.register((obj, fail) => {
    if (obj.value && obj.value !== "value") {
        fail(new OptionsValidationError("Value must be 'value'."));
    }
});

interface IFooService {
    readonly foo: string;
}

interface IBarService {
    readonly bar: string;
}

interface ICircular1Service {
}

interface ICircular2Service {
}

interface ICircular3Service {
}

interface ICompositeService {
    getFoo(): string;
    getBar(): string;
}

interface ICompositeService2 {
    getFoo(): string;
    getBar(): string;
}

interface ISingletonService {
    readonly value: string;
}

interface ITestService extends IDisposable {
    readonly name: string;
    readonly isDisposed: boolean;
}

interface ITestOptions {
    readonly foo: string;
    readonly bar: string;
}

interface ITestOptionsWithValidation {
    readonly foo: string;
    readonly bar: string;
    readonly value?: string;
}

interface ITestServiceWithOptions {
    getFoo(): string;
    getBar(): string;
}

interface IChildScopedService {
}

interface IParentSingletonService {
}

class BarServiceThatThrows implements IBarService {
    readonly bar = "bar";

    constructor() {
        throw new Error("Thrown from bar service.");
    }
}

class FooBarService implements IFooService, IBarService {
    readonly foo = "foo";
    readonly bar = "bar";
}

class Circular1Service implements ICircular1Service {
    constructor(@ICircular2Service service: ICircular2Service) {
    }
}

class Circular2Service implements ICircular2Service {
    constructor(@ICircular3Service service: ICircular3Service) {
    }
}

class Circular3Service implements ICircular3Service {
    constructor(@ICircular1Service service: ICircular1Service) {
    }
}

class CompositeService implements ICompositeService {
    constructor(
        @IFooService private readonly fooService: IFooService,
        @IBarService private readonly barService: IBarService) {
    }

    getFoo(): string {
        return this.fooService.foo;
    }

    getBar(): string {
        return this.barService.bar;
    }
}

class CompositeService2 implements ICompositeService2 {
    constructor(
        @ICompositeService private readonly compositeService: ICompositeService,
        @IFooService fooService: IFooService,
        @IBarService barService: IBarService) {
    }

    getFoo(): string {
        return this.compositeService.getFoo();
    }

    getBar(): string {
        return this.compositeService.getBar();
    }
}

class SubCompositeService extends CompositeService {
    getFooBar(): string {
        return this.getFoo() + this.getBar();
    }
}

@Singleton
class SingletonService implements ISingletonService {
    value = "singleton";
}

class TestService implements ITestService {
    name = "test-service";
    isDisposed = false;

    dispose(): void {
        this.isDisposed = true;
    }
}

class TestService2 implements ITestService {
    name = "test-service2";
    isDisposed = false;

    dispose(): void {
        this.isDisposed = true;
    }
}

class TestServiceWithOptions implements ITestServiceWithOptions {
    constructor(@ITestOptions private readonly options: ITestOptions) {
    }

    getFoo(): string {
        return this.options.foo;
    }

    getBar(): string {
        return this.options.bar;
    }
}

@Scoped
class ChildScopedService implements IChildScopedService {
}

@Singleton
class ParentSingletonService implements IParentSingletonService {
    constructor(@IChildScopedService scopedService: IChildScopedService) {
    }
}

describe("service lifetime", () => {
    test("register service instance", () => {
        const services = new ServiceMap();
        const instance = new TestService();

        services.registerInstance(ITestService, instance);

        const instance1 = services.get(ITestService);
        const instance2 = services.get(ITestService);
        const instance3 = services.createScope().get(ITestService);

        expect(instance).toBe(instance1);
        expect(instance).toBe(instance2);
        expect(instance).toBe(instance3);
    });

    test("register singleton", () => {
        const services = new ServiceMap();

        services.registerSingleton(ITestService, TestService);

        const instance1 = services.get(ITestService);
        const instance2 = services.get(ITestService);
        const instance3 = services.createScope().get(ITestService);

        expect(instance1).toBeInstanceOf(TestService);
        expect(instance1).toBe(instance2);
        expect(instance1).toBe(instance3);
    });

    test("register singleton with multiple interfaces using service factory", () => {
        const services = new ServiceMap();

        const factory = new SingletonServiceFactory(FooBarService);
        services.registerSingleton(IFooService, factory);
        services.registerSingleton(IBarService, factory);

        const foo = services.get(IFooService);
        const bar = services.get(IBarService);
        
        expect(foo).toBe(bar);
    });

    test("register singleton with scope decorator", () => {
        const services = new ServiceMap();

        services.register(ISingletonService, SingletonService);

        const instance1 = services.get(ISingletonService);
        const instance2 = services.get(ISingletonService);
        const instance3 = services.createScope().get(ISingletonService);
        const instance4 = services.createScope().get(ISingletonService);

        expect(instance1).toBeInstanceOf(SingletonService);
        expect(instance1).toBe(instance2);
        expect(instance1).toBe(instance3);
        expect(instance1).toBe(instance4);
    });

    test("register singleton and create a chain of scoped collections", () => {
        const services = new ServiceMap();

        services.register(ISingletonService, SingletonService);

        const scope1 = services.createScope();
        const scope2 = scope1.createScope();
        const scope3 = scope2.createScope();
        const scope4 = scope3.createScope();

        const instance1 = scope4.get(ISingletonService);
        const instance2 = scope3.get(ISingletonService);
        const instance3 = scope2.get(ISingletonService);
        const instance4 = scope1.get(ISingletonService);
        const instance5 = services.get(ISingletonService);

        expect(instance1).toBeInstanceOf(SingletonService);
        expect(instance1).toBe(instance2);
        expect(instance1).toBe(instance3);
        expect(instance1).toBe(instance4);
        expect(instance1).toBe(instance5);
    });

    test("register scoped", () => {
        const services = new ServiceMap();

        services.registerScoped(ITestService, TestService);

        const instance1 = services.get(ITestService);

        const scopedService = services.createScope();
        const instance2 = scopedService.get(ITestService);
        const instance3 = scopedService.get(ITestService);

        expect(instance1).not.toBe(instance2);
        expect(instance2).toBe(instance3);
    });

    test("register transient", () => {
        const services = new ServiceMap();

        services.registerTransient(ITestService, TestService);

        const instance1 = services.get(ITestService);
        const instance2 = services.get(ITestService);

        expect(instance1).toBeInstanceOf(TestService);
        expect(instance1).not.toBe(instance2);
    });

    test("register service that overrides an existing service", () => {
        const services = new ServiceMap();

        services.registerSingleton(ITestService, TestService);
        services.registerTransient(ITestService, TestService2);

        const instance1 = services.get(ITestService);
        const instance2 = services.get(ITestService);

        // make sure the override is transient
        expect(instance1).toBeInstanceOf(TestService2);
        expect(instance1).not.toBe(instance2);

        expect(instance1.name).toBe("test-service2");
    });

    test("register service that attempts to override a sealed service", () => {
        const services = new ServiceMap();

        services.registerSingleton(ITestService, TestService, { sealed: true });
        const result = services.tryRegisterTransient(ITestService, TestService2);
        const instance = services.get(ITestService);

        expect(result).toBe(false);
        expect(instance).toBeInstanceOf(TestService);
    });
});

describe("service options", () => {
    test("configure options", () => {
        const services = new ServiceMap();

        services.configureOptions(ITestOptions, options => ({
            ...options,
            foo: "test"
        }));

        const options = services.getOptions(ITestOptions);
        expect(options.foo).toBe("test");
        expect(options.bar).toBe("default-bar");
    });

    test("configure options with multiple callbacks", () => {
        const services = new ServiceMap();

        services.configureOptions(ITestOptions, options => ({ ...options, foo: "1" }));
        services.configureOptions(ITestOptions, options => ({ ...options, foo: options.foo + "2" }));
        services.configureOptions(ITestOptions, options => ({ ...options, foo: options.foo + "3" }));

        const options = services.getOptions(ITestOptions);
        expect(options.foo).toBe("123");
        expect(options.bar).toBe("default-bar");
    });

    test("configure options with options from custom provider", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ foo: "custom-foo" })
        });        

        services.configureOptions(ITestOptions, options => ({
            ...options,
            foo: options.foo + "!!"
        }));

        const options = services.getOptions(ITestOptions);
        expect(options.foo).toBe("custom-foo!!");
        expect(options.bar).toBe("default-bar");
    });    

    test("get default options", () => {
        const services = new ServiceMap();
        const options = services.getOptions(ITestOptions);
        expect(options.foo).toBe("default-foo");
        expect(options.bar).toBe("default-bar");
    });

    test("get default options when custom provider does not support options for an id", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => undefined
        });

        const options = services.getOptions(ITestOptions);
        
        expect(options.foo).toBe("default-foo");
        expect(options.bar).toBe("default-bar");
    });

    test("get options from custom provider", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "custom-foo",
                bar: "custom-bar"
            })
        });

        const options = services.getOptions(ITestOptions);
        
        expect(options.foo).toBe("custom-foo");
        expect(options.bar).toBe("custom-bar");
    });
    
    test("get options from custom provider that only returns a partial options object", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "custom-foo"
            })
        });

        const options = services.getOptions(ITestOptions);
        
        expect(options.foo).toBe("custom-foo");
        expect(options.bar).toBe("default-bar");
    });

    test("get options with validation that succeeds", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "foo",
                bar: "bar",
                value: "value"
            })
        });

        // this will throw if the validation failed
        services.getOptions(ITestOptionsWithValidation);
    });  
    
    test("get options with custom validation callback that fails", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "foo",
                bar: "bar",
                value: "value2"
            })
        });

        try {
            services.getOptions(ITestOptionsWithValidation);
            fail();
        }
        catch (err) {
            expect(err.message).toBe("Value must be 'value'.");
        }
    });
    
    test("get options with required property that fails", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                bar: "bar",
                value: "value"
            })
        });

        try {
            services.getOptions(ITestOptionsWithValidation);
            fail();
        }
        catch (err) {
            expect(err.message).toBe("Options (test-with-validation) property (foo) is required.");
        }
    });    
});

describe("service dependency injection", () => {
    test("inject service dependencies", () => {
        const services = new ServiceMap();

        services.registerTransient(ICompositeService, CompositeService);
        services.registerTransient(IFooService, FooBarService);
        services.registerTransient(IBarService, FooBarService);

        const service = services.get(ICompositeService);

        expect(service.getFoo()).toBe("foo");
        expect(service.getBar()).toBe("bar");
    });

    test("inject service dependencies into Base type", () => {
        const services = new ServiceMap();

        services.registerTransient(ICompositeService, SubCompositeService);
        services.registerTransient(IFooService, FooBarService);
        services.registerTransient(IBarService, FooBarService);

        const service = <SubCompositeService>services.get(ICompositeService);

        expect(service.getFoo()).toBe("foo");
        expect(service.getBar()).toBe("bar");
        expect(service.getFooBar()).toBe("foobar");
    });

    test("inject service whose dependent has the same dependencies", () => {
        const services = new ServiceMap();

        services.registerTransient(ICompositeService, CompositeService);
        services.registerTransient(ICompositeService2, CompositeService2);
        services.registerTransient(IFooService, FooBarService);
        services.registerTransient(IBarService, FooBarService);

        const service = services.get(ICompositeService2);

        expect(service.getFoo()).toBe("foo");
        expect(service.getBar()).toBe("bar");
    });

    test("inject service dependency that throws Error", () => {
        const services = new ServiceMap();

        services.registerTransient(ICompositeService, CompositeService);
        services.registerTransient(IFooService, FooBarService);
        services.registerTransient(IBarService, BarServiceThatThrows);

        try {
            services.get(ICompositeService);
            fail();
        }
        catch { }

        // now register a Bar service that doesn't throw
        services.registerTransient(IBarService, FooBarService);

        try {
            services.get(ICompositeService);
        }
        catch {
            // this is to ensure that the internal state for the service collection is getting
            // reset properly after trying to get a service that has previously failed
            fail();
        }
    });

    test("inject service with circular dependency", () => {
        const services = new ServiceMap();

        services.registerTransient(ICircular1Service, Circular1Service);
        services.registerTransient(ICircular2Service, Circular2Service);
        services.registerTransient(ICircular3Service, Circular3Service);

        try {
            services.get(ICircular1Service);
            fail();
        }
        catch (err) {
            expect((<string>err.message).indexOf("Circular dependency detected")).toBeGreaterThan(-1);
        }        
    });

    test("inject scoped service into a singleton service", () => {
        const services = new ServiceMap();

        services.register(IChildScopedService, ChildScopedService);
        services.register(IParentSingletonService, ParentSingletonService);

        try {
            services.get(IParentSingletonService);
            fail();
        }
        catch (err) {
            expect((<string>err.message).indexOf("Scoped services should only be referenced by Transient or other Scoped services.")).toBeGreaterThan(-1);
        }        
    });

    test("inject service options", () => {
        const services = new ServiceMap();

        services.registerTransient(ITestServiceWithOptions, TestServiceWithOptions);
        const service = services.get(ITestServiceWithOptions);

        expect(service.getFoo()).toBe("default-foo");
        expect(service.getBar()).toBe("default-bar");
    });

    test("inject service options from custom options provider", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "custom-foo",
                bar: "custom-bar"
            })
        });

        services.registerTransient(ITestServiceWithOptions, TestServiceWithOptions);
        const service = services.get(ITestServiceWithOptions);

        expect(service.getFoo()).toBe("custom-foo");
        expect(service.getBar()).toBe("custom-bar");
    });

    test("inject service options from custom options provider with partial options object", () => {
        const services = new ServiceMap();
        services.addOptionsProvider({
            tryGet: () => <any>({ 
                foo: "custom-foo"
            })
        });

        services.registerTransient(ITestServiceWithOptions, TestServiceWithOptions);
        const service = services.get(ITestServiceWithOptions);

        expect(service.getFoo()).toBe("custom-foo");
        expect(service.getBar()).toBe("default-bar");
    });    
});

describe("service disposal", () => {
    test("ensure instance service does not get disposed", () => {
        const services = new ServiceMap();
        const instance = new TestService();

        services.registerInstance(ITestService, instance);

        const scope = services.createScope();
        scope.dispose();

        expect(instance.isDisposed).toBeFalsy();
    });

    test("ensure singleton service does not get disposed", () => {
        const services = new ServiceMap();

        services.registerSingleton(ITestService, TestService);

        const instance = services.get(ITestService);
        const scope = services.createScope();
        scope.dispose();

        expect(instance.isDisposed).toBeFalsy();
    });

    test("ensure scoped service gets disposed", () => {
        const services = new ServiceMap();

        services.registerScoped(ITestService, TestService);

        const scope = services.createScope();
        const instance = scope.get(ITestService);

        scope.dispose();

        expect(instance.isDisposed).toBeTruthy();
    });

    test("ensure transient service does not get disposed", () => {
        const services = new ServiceMap();

        services.registerTransient(ITestService, TestService);

        const scope = services.createScope();
        const instance = scope.get(ITestService);

        scope.dispose();

        // the service collection does not maintain a reference to transient instances and are thus not tied to the scopes lifecycle
        expect(instance.isDisposed).toBeFalsy();
    });

    test("ensure instance of self is ignored when disposing", () => {
        const services = new ServiceMap();

        const scope = services.createScope();
        scope.get(IServiceCollection);
        scope.dispose();

        // no need to assert, simply verifying the call to dispose does not cause a stack overflow
    });
});

describe("service scope", () => {
    test("service collection is same instance as scope", () => {
        const parent = new ServiceMap();
        const scope1 = parent.createScope();
        const scope2 = scope1.createScope();
        const services = scope2.get(IServiceCollection);

        expect(services).not.toBe(parent);
        expect(services).not.toBe(scope1);
        expect(services).toBe(scope2);
    });

    test("instantiation service is same instance as scope", () => {
        const parent = new ServiceMap();
        const scope = parent.createScope();
        const instantiation = scope.get(IInstantiationService);
        expect(instantiation).toBe(scope);
    });
});