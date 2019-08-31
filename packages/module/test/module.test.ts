import { createOptions, createService, IOptionsService, IServiceRegistration } from "@shrub/service-collection";
import { combineExtensions, createConfigType, createHostBuilder, IModule, IModuleConfigurator, IModuleInitializer, loadModules } from "../src/module";

describe("module loader", () => {
    beforeEach(() => modules.length = 0);

    test("load module with dependencies", async () => {
        await loadModules([ModuleC]);

        expect(modules).toHaveLength(3);
        expect(modules[0].name).toBe("module-a");
        expect(modules[1].name).toBe("module-b");
        expect(modules[2].name).toBe("module-c");
    });

    test("get instance from host", async () => {
        const host = createHostBuilder()
            .useModules([ModuleC])
            .build();

        await host.load();

        // ModuleA was loaded because ModuleC has it as a dependency
        const moduleA = host.getInstance(ModuleA);
        const moduleC = host.getInstance(ModuleC);
        expect(moduleA.name).toBe("module-a");
        expect(moduleC.name).toBe("module-c");
    });
    
    test("get module instance not created from constructor", async () => {
        const moduleC = new ModuleC();
        const host = createHostBuilder()
            .useModules([moduleC])
            .build();

        await host.load();

        const a = host.getInstance(ModuleA);
        const b = host.getInstance(ModuleB);
        const c = host.getInstance(ModuleC);

        expect(a.name).toBe("module-a");
        expect(b.name).toBe("module-b");
        expect(c).toBe(moduleC);
    });     

    test("load module that binds options to its settings", async () => {
        const host = createHostBuilder()
            .useModules([BindSettingsModule])
            .useSettings({
                test: { value: "Hello World!" }
            })
            .build();

        await host.load();

        const options = host.services.get(IOptionsService).getOptions(ITestOptions);
        expect(options.value).toBe("Hello World!");
    });

    test("load module that binds options to a section of its settings that then get injected into a service instance", async () => {
        const host = createHostBuilder()
            .useModules([FooModule])
            .useSettings({
                foo: {
                    bar: { value: "Hello World!" }
                }
            })
            .build();

        await host.load();

        const module = host.getInstance(FooModule);
        expect(module.bar!.getBar()).toBe("Hello World!");
    }); 
    
    test("load module that binds options that fallback to the option's default values", async () => {
        // by omitting the settings the service object should fallback to it's configured defaults
        const host = await loadModules([FooModule]);
        const module = host.getInstance(FooModule);
        expect(module.bar!.getBar()).toBe("default");
    });     

    test("load modules when defined out of order", async () => {
        await loadModules([
            ModuleC,
            ModuleA
        ]);

        expect(modules).toHaveLength(3);
        expect(modules[0].name).toBe("module-a");
        expect(modules[1].name).toBe("module-b");
        expect(modules[2].name).toBe("module-c");
    });

    test("load module that configures dependency", async () => {
        const host = await loadModules([DependentAModule]);
        const module = host.getInstance(ConfigurableModule);
        expect(module.value).toBe("test");
    });

    test("load module that forces dependent to configure first", async () => {
        const host = createHostBuilder()
            .useModules([
                DependentAModule,
                DependentBModule
            ])
            .useSettings({
                "configurable-module": { invokeNext: 1 }
            })
            .build();

        await host.load();

        expect(modules).toHaveLength(3);
        expect(modules[0].name).toBe("dependent-a-module");
        expect(modules[1].name).toBe("dependent-b-module");
        expect(modules[2].name).toBe("configurable-module");
    }); 
    
    test("load module that invokes next multiple times during configure", async () => {
        const host = createHostBuilder()
            .useModules([
                DependentAModule,
                DependentBModule
            ])
            .useSettings({
                "configurable-module": { invokeNext: 2 }
            })
            .build();

        await host.load();

        expect(modules).toHaveLength(3);
        expect(modules[0].name).toBe("dependent-a-module");
        expect(modules[1].name).toBe("dependent-b-module");
        expect(modules[2].name).toBe("configurable-module");
    });

    test("extend module host", async () => {
        const builder = createHostBuilder(factory => (services, modules, settings) => {
            return factory(services, [...modules, FooModule], settings);
        });

        const host = builder.useModules([ModuleC]).build();
        await host.load();

        const module = host.getInstance(FooModule);
        expect(module.name).toBe("foo");
    });

    test("extend module host with multiple extensions using combineExtensions and ensure propery order", async () => {
        let tag = "";
        const extension = combineExtensions(
            factory => {
                tag += "1";
                return factory;
            },
            factory => {
                tag += "2";
                return factory;
            },
            factory => {
                tag += "3";
                return factory;
            }
        );

        const builder = createHostBuilder(extension);
        const host = builder.useModules([ModuleC]).build();

        await host.load();

        expect(tag).toBe("123");
    });    
});

// captures modules when they are configured
const modules: IModule[] = [];

class ModuleA implements IModule {
    readonly name = "module-a";

    configure(): void {
        modules.push(this);
    }
}

class ModuleB implements IModule {
    readonly name = "module-b";
    readonly dependencies = [ModuleA];

    configure(): void {
        modules.push(this);
    }
}

class ModuleC implements IModule {
    readonly name = "module-c";
    readonly dependencies = [ModuleB];

    configure(): void {
        modules.push(this);
    }
}

const IBarOptions = createOptions<IBarOptions>("bar-options", { value: "default" });
interface IBarOptions {
    readonly value: string;
}

const IBarService = createService<IBarService>("bar-service");
interface IBarService {
    getBar(): string;
}

class BarService implements IBarService {
    constructor(@IBarOptions private readonly options: IBarOptions) {
    }

    getBar(): string {
        return this.options.value;
    }
}

class FooModule implements IModule {
    readonly name = "foo";

    bar?: IBarService;

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(IBarOptions, "bar");
    }

    configureServices(registration: IServiceRegistration): void {
        registration.registerTransient(IBarService, BarService);
    }

    configure({ services }: IModuleConfigurator): void {
        modules.push(this);
        this.bar = services.get(IBarService);
    }
}

const ITestOptions = createOptions<ITestOptions>("test-options");
interface ITestOptions {
    readonly value: string;
}

class BindSettingsModule implements IModule {
    readonly name = "test";

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(ITestOptions);
    }
}

const IConfigurableModuleConfiguration = createConfigType<IConfigurableModuleConfiguration>();
interface IConfigurableModuleConfiguration {
    setValue(value: string): void;
}

class ConfigurableModule implements IModule {
    readonly name = "configurable-module";
    value = "";

    initialize(init: IModuleInitializer): void {
        init.config(IConfigurableModuleConfiguration).register(() => ({
            setValue: value => this.value = value
        }));
    }

    async configure({ settings, next }: IModuleConfigurator): Promise<void> {
        if (settings.invokeNext) {
            for (let i = 0; i < settings.invokeNext; i++) {
                await next();
            }
        }

        modules.push(this);
    }
}

class DependentAModule implements IModule {
    readonly name = "dependent-a-module";
    readonly dependencies = [ConfigurableModule];

    configure({ config }: IModuleConfigurator): void {
        modules.push(this);
        config.get(IConfigurableModuleConfiguration).setValue("test");
    }
}

class DependentBModule implements IModule {
    readonly name = "dependent-b-module";
    readonly dependencies = [ConfigurableModule];

    configure({ config }: IModuleConfigurator): void {
        modules.push(this);
        config.get(IConfigurableModuleConfiguration).setValue("test");
    }
}