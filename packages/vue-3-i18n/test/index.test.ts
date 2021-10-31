import { IModule, IModuleCollection, ModuleLoader } from "@shrub/core";
import { IVueAppService, IVueConfiguration } from "@shrub/vue-3";
import { defineComponent, h } from "vue";
import { IVueI18nConfiguration, IVueI18nService, VueI18nModule } from "../src";

// the vue module is expecting an element with id app to mount to
document.body.innerHTML = '<!doctype html><html><body><div id="app"></div></body></html>';

function setup(...modules: IModule[]): Promise<IModuleCollection> {
    return ModuleLoader.load([...modules, {
        name: "setup",
        dependencies: [VueI18nModule],
        configure: ({ config }) => {
            config.get(IVueConfiguration).mount(defineComponent({
                setup: () => () => h("div")
            }))
        }
    }]);
}

describe("module", () => {
    test("verify vue-i18n installation", async () => {
        const collection = await setup();
        const instance = collection.services.get(IVueAppService).instance;

        expect(instance.$i18n).toBeDefined();
    });

    test("get message for default locale", async () => {
        const collection = await setup({
            name: "test",
            dependencies: [VueI18nModule],
            configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                "en-US": { hi: "hi" },
                "es": { hi: "hola" }
            })
        });

        const instance = collection.services.get(IVueAppService).instance;
        expect(instance.$t("hi")).toBe("hi");
    });

    test("manually load locale messages", async () => {
        const collection = await setup();
        const service = collection.services.get(IVueI18nService);
        const instance = collection.services.get(IVueAppService).instance;

        await service.load(() => Promise.resolve({
            "en-US": { hi: "hi" },
            "es": { hi: "hola" }
        }));

        expect(instance.$t("hi")).toBe("hi");
    });

    test("merge messages from multiple modules", async () => {
        const collection = await setup(
            {
                name: "test",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { foo: "foo" }
                })
            },
            {
                name: "test 2",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { bar: "bar" }
                })
            }
        );

        const instance = collection.services.get(IVueAppService).instance;
        expect(instance.$t("foo")).toBe("foo");
        expect(instance.$t("bar")).toBe("bar");
    });

    test("change the current locale", async () => {
        let changed: boolean | undefined;
        const collection = await setup({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(options => Promise.resolve({
                foo: options.locale
            }))
        });

        const instance = collection.services.get(IVueAppService).instance;
        const service = collection.services.get(IVueI18nService);

        service.onLocaleChanged(() => changed = true);
        await service.setLocale("es");

        expect(service.currentLocale).toBe("es");
        expect(changed).toBe(true);

        expect(instance.$i18n.locale).toBe("es");
        expect(instance.$t("foo")).toBe("es");
    });

    test("change the current locale for loader that does not support the new locale and use fallback", async () => {
        let changed: boolean | undefined;
        const collection = await setup({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(options => {
                if (options.locale !== "en-US") {
                    return Promise.reject(new Error("Locale not supported."));
                }

                return Promise.resolve({
                    foo: options.locale
                });
            })
        });

        const instance = collection.services.get(IVueAppService).instance;
        const service = collection.services.get(IVueI18nService);

        service.onLocaleChanged(() => changed = true);
        await service.setLocale("es");

        expect(service.currentLocale).toBe("es");
        expect(changed).toBe(true);

        expect(instance.$i18n.locale).toBe("es");
        expect(instance.$t("foo")).toBe("en-US");
    });

    test("change the current locale for loader that does not support the new locale or the fallback locale", async () => {
        const collection = await setup({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(() => Promise.reject(new Error("Locale not supported.")))
        });

        const service = collection.services.get(IVueI18nService);

        // set the locale and make sure it doesn't fail
        await service.setLocale("es");
    });
});