import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, ModuleLoadError, ModuleLoader } from "../src/module";
import { createOptions, createService, IOptionsService, IServiceRegistration } from "../src/service-collection";

describe("module loader", () => {
    beforeEach(() => capturedModules.length = 0);

    test("load module with dependencies", async () => {
        await ModuleLoader.load([ModuleC]);

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
    });

    test("load module with async dependencies", async () => {
        await ModuleLoader.load([ModuleE]);

        expect(capturedModules).toHaveLength(5);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
        expect(capturedModules[3].name).toBe("module-d");
        expect(capturedModules[4].name).toBe("module-e");
    });

    test("load module with async dependency that returns class", async () => {
        await ModuleLoader.load([{
            name: "test",
            dependencies: [() => Promise.resolve(ModuleE)]
        }]);

        expect(capturedModules).toHaveLength(5);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
        expect(capturedModules[3].name).toBe("module-d");
        expect(capturedModules[4].name).toBe("module-e");
    });

    test("get instance from module collection", async () => {
        const modules = await ModuleLoader.load([ModuleC]);

        // ModuleA was loaded because ModuleC has it as a dependency
        const moduleA = modules.getInstance(ModuleA);
        const moduleC = modules.getInstance(ModuleC);
        expect(moduleA.name).toBe("module-a");
        expect(moduleC.name).toBe("module-c");
    });
    
    test("get module instance not created from constructor", async () => {
        const instance = new ModuleC();
        const modules = await ModuleLoader.load([instance]);

        const a = modules.getInstance(ModuleA);
        const b = modules.getInstance(ModuleB);
        const c = modules.getInstance(ModuleC);

        expect(a.name).toBe("module-a");
        expect(b.name).toBe("module-b");
        expect(c).toBe(instance);
    });     

    test("load module that binds options to its settings", async () => {
        const modules = await ModuleLoader
            .useModules([BindSettingsModule])
            .useSettings({
                test: { value: "Hello World!" }
            })
            .load();

        const options = modules.services.get(IOptionsService).getOptions(ITestOptions);
        expect(options.value).toBe("Hello World!");
    });

    test("load module that binds options to a section of its settings that then get injected into a service instance", async () => {
        const modules = await ModuleLoader
            .useModules([FooModule])
            .useSettings({
                foo: {
                    bar: { value: "Hello World!" }
                }
            })
            .load();

        const module = modules.getInstance(FooModule);
        expect(module.bar!.getBar()).toBe("Hello World!");
    }); 
    
    test("load module that binds options that fallback to the option's default values", async () => {
        // by omitting the settings the service object should fallback to it's configured defaults
        const host = await ModuleLoader.load([FooModule]);
        const module = host.getInstance(FooModule);
        expect(module.bar!.getBar()).toBe("default");
    });

    test("load modules when defined out of order", async () => {
        await ModuleLoader.load([
            ModuleC,
            ModuleA
        ]);

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
    });

    test("load JSON object module instance that depends on another JSON object module instance", async () => {
        const test = { 
            name: "test",
            configure(): void {
                capturedModules.push(this);
            }
        };
        const tester = { 
            name: "tester",
            dependencies: [test],
            configure(): void {
                capturedModules.push(this);
            }
        };


        await ModuleLoader.useModules([test, tester]).load();

        expect(capturedModules).toHaveLength(2);
        expect(capturedModules[0].name).toBe("test");
        expect(capturedModules[1].name).toBe("tester");
    });

    test("load multiple JSON object module instances", async () => {
        await ModuleLoader
            .useModules([
                { 
                    name: "test",
                    configure(): void {
                        capturedModules.push(this);
                    }
                },
                { 
                    name: "tester",
                    configure(): void {
                        capturedModules.push(this);
                    }
                }
            ])
            .load();

        expect(capturedModules).toHaveLength(2);
        expect(capturedModules[0].name).toBe("test");
        expect(capturedModules[1].name).toBe("tester");
    }); 

    test("load JSON object module instance multiple times", async () => {
        const module = { 
            name: "test",
            configure(): void {
                capturedModules.push(this);
            }
        };

        await ModuleLoader.useModules([module, module, module]).load();

        expect(capturedModules).toHaveLength(1);
        expect(capturedModules[0].name).toBe("test");
    }); 

    test("load modules invoking the ModuleLoader useModules method multiple times", async () => {
        await ModuleLoader
            .useModules([ModuleA])
            .useModules([ModuleC])
            .load();

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
    });   

    test("load module instances invoking the ModuleLoader useModules method multiple times", async () => {
        await ModuleLoader
            .useModules([new ModuleA()])
            .useModules([new ModuleC()])
            .load();

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("module-a");
        expect(capturedModules[1].name).toBe("module-b");
        expect(capturedModules[2].name).toBe("module-c");
    });

    test("load module that configures dependency", async () => {
        const host = await ModuleLoader.load([DependentAModule]);
        const module = host.getInstance(ConfigurableModule);
        expect(module.value).toBe("test");
    });

    test("load module that forces dependent to configure first", async () => {
        await ModuleLoader
            .useModules([
                DependentAModule,
                DependentBModule
            ])
            .useSettings({
                "configurable-module": { invokeNext: 1 }
            })
            .load();

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("dependent-a-module");
        expect(capturedModules[1].name).toBe("dependent-b-module");
        expect(capturedModules[2].name).toBe("configurable-module");
    }); 
    
    test("load module that invokes next multiple times during configure", async () => {
        await ModuleLoader
            .useModules([
                DependentAModule,
                DependentBModule
            ])
            .useSettings({
                "configurable-module": { invokeNext: 2 }
            })
            .load();

        expect(capturedModules).toHaveLength(3);
        expect(capturedModules[0].name).toBe("dependent-a-module");
        expect(capturedModules[1].name).toBe("dependent-b-module");
        expect(capturedModules[2].name).toBe("configurable-module");
    });  

    test("load duplicate modules", async () => {
        // make sure an error is not thrown
        const modules = await ModuleLoader.load([ModuleC, ModuleC, ModuleC]);
        modules.getInstance(ModuleC);
    });

    test("load duplicate module instances", async () => {
        try {
            await ModuleLoader.load([new ModuleC(), new ModuleC(), new ModuleC()]);
            fail();
        }
        catch (err) {
            expect(err).toBeInstanceOf(ModuleLoadError);
        }
    });
});

// captures modules when they are configured
const capturedModules: IModule[] = [];

class ModuleA implements IModule {
    readonly name = "module-a";

    configure(): void {
        capturedModules.push(this);
    }
}

class ModuleB implements IModule {
    readonly name = "module-b";
    readonly dependencies = [ModuleA];

    configure(): void {
        capturedModules.push(this);
    }
}

class ModuleC implements IModule {
    readonly name = "module-c";
    readonly dependencies = [ModuleB];

    configure(): void {
        capturedModules.push(this);
    }
}

const ModuleD = () => new Promise(resolve => {
    setTimeout(() => {
        resolve(new class implements IModule {
            readonly name = "module-d";
            readonly dependencies = [ModuleC];

            configure(): void {
                capturedModules.push(this);
            }
        });
    }, 
    1);
});

class ModuleE implements IModule {
    readonly name = "module-e";
    readonly dependencies = [ModuleD];

    configure(): void {
        capturedModules.push(this);
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

    configure({ services, options }: IModuleConfigurator): void {
        // simply test that the IBarOptions can be read during configuration
        options.get(IBarOptions);

        capturedModules.push(this);
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

const IConfigurableModuleConfiguration = createConfig<IConfigurableModuleConfiguration>();
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

        capturedModules.push(this);
    }
}

class DependentAModule implements IModule {
    readonly name = "dependent-a-module";
    readonly dependencies = [ConfigurableModule];

    configure({ config }: IModuleConfigurator): void {
        capturedModules.push(this);
        config.get(IConfigurableModuleConfiguration).setValue("test");
    }
}

class DependentBModule implements IModule {
    readonly name = "dependent-b-module";
    readonly dependencies = [ConfigurableModule];

    configure({ config }: IModuleConfigurator): void {
        capturedModules.push(this);
        config.get(IConfigurableModuleConfiguration).setValue("test");
    }
}