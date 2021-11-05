import { IModule, IModuleCollection, ModuleLoader } from "@shrub/core";
import { IVueAppService, IVueConfiguration } from "@shrub/vue-3";
import { defineComponent, h } from "vue";
import { Composer, useI18n } from "vue-i18n";
import { IVueI18nConfiguration, IVueI18nService, VueI18nModule } from "../src";

interface ISetupCompositionResult {
    readonly collection: IModuleCollection;
    readonly i18n: Composer;
}

// the vue module is expecting an element with id app to mount to
document.body.innerHTML = '<!doctype html><html><body><div id="app"></div></body></html>';

function setupLegacy(...modules: IModule[]): Promise<IModuleCollection> {
    return ModuleLoader
        .useSettings({ "vue-i18n": { legacy: true } })
        .useModules([...modules, {
            name: "setup",
            dependencies: [VueI18nModule],
            configure: ({ config }) => {
                config.get(IVueConfiguration).mount(defineComponent({
                    setup: () => () => h("div")
                }))
            }
        }])
        .load();
}

async function setupComposition(...modules: IModule[]): Promise<ISetupCompositionResult> {
    let i18n: Composer;
    const collection = await ModuleLoader
        .useModules([...modules, {
            name: "setup",
            dependencies: [VueI18nModule],
            configure: ({ config }) => {
                config.get(IVueConfiguration).mount(defineComponent({
                    setup: () => {
                        i18n = useI18n();
                        return () => h("div");
                    }
                }))
            }
        }])
        .load();

    return {
        collection,
        get i18n() {
            return i18n;
        }
    };
}

describe("module - legacy mode", () => {
    test("verify vue-i18n installation", async () => {
        const collection = await setupLegacy();
        const instance = collection.services.get(IVueAppService).instance;

        expect(instance.$i18n).toBeDefined();
    });

    test("get message for default locale", async () => {
        const collection = await setupLegacy({
            name: "test",
            dependencies: [VueI18nModule],
            configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                "en-US": { hi: "hi!" },
                "es": { hi: "hola" }
            })
        });

        const instance = collection.services.get(IVueAppService).instance;
        expect(instance.$t("hi")).toBe("hi!");
    });

    test("manually load locale messages", async () => {
        const collection = await setupLegacy();
        const service = collection.services.get(IVueI18nService);
        const instance = collection.services.get(IVueAppService).instance;

        await service.load(() => Promise.resolve({ hi: "hi!" }));

        expect(instance.$t("hi")).toBe("hi!");
    });

    test("merge messages from multiple modules", async () => {
        const collection = await setupLegacy( 
            {
                name: "test",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { foo: "foo!" }
                })
            },
            {
                name: "test 2",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { bar: "bar!" }
                })
            }
        );

        const instance = collection.services.get(IVueAppService).instance;
        expect(instance.$t("foo")).toBe("foo!");
        expect(instance.$t("bar")).toBe("bar!");
    });

    test("change the current locale", async () => {
        let changed: boolean | undefined;
        const collection = await setupLegacy({
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
        const collection = await setupLegacy({
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
        const collection = await setupLegacy({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(() => Promise.reject(new Error("Locale not supported.")))
        });

        const service = collection.services.get(IVueI18nService);

        // set the locale and make sure it doesn't fail
        await service.setLocale("es");
    });
});

describe("module - composition mode", () => {
    test("verify vue-i18n installation", async () => {
        const result = await setupComposition();
        const service = result.collection.services.get(IVueI18nService);

        expect((<any>service).i18n).toBe(result.i18n);
    });

    test("get message for default locale", async () => {
        const result = await setupComposition({
            name: "test",
            dependencies: [VueI18nModule],
            configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                "en-US": { hi: "hi!" },
                "es": { hi: "hola" }
            })
        });

        expect(result.i18n.t("hi")).toBe("hi!");
    });

    test("manually load locale messages", async () => {
        const result = await setupComposition();
        const service = result.collection.services.get(IVueI18nService);

        await service.load(() => Promise.resolve({ hi: "hi!" }));

        expect(result.i18n.t("hi")).toBe("hi!");
    });

    test("merge messages from multiple modules", async () => {
        const result = await setupComposition(
            {
                name: "test",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { foo: "foo!" }
                })
            },
            {
                name: "test 2",
                dependencies: [VueI18nModule],
                configure: ({ config }) => config.get(IVueI18nConfiguration).register({
                    "en-US": { bar: "bar!" }
                })
            }
        );

        expect(result.i18n.t("foo")).toBe("foo!");
        expect(result.i18n.t("bar")).toBe("bar!");
    });

    test("change the current locale", async () => {
        let changed: boolean | undefined;
        const result = await setupComposition({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(options => Promise.resolve({
                foo: options.locale
            }))
        });

        const service = result.collection.services.get(IVueI18nService);

        service.onLocaleChanged(() => changed = true);
        await service.setLocale("es");

        expect(service.currentLocale).toBe("es");
        expect(changed).toBe(true);

        expect(result.i18n.locale.value).toBe("es");
        expect(result.i18n.t("foo")).toBe("es");
    });

    test("change the current locale for loader that does not support the new locale and use fallback", async () => {
        let changed: boolean | undefined;
        const result = await setupComposition({
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

        const service = result.collection.services.get(IVueI18nService);

        service.onLocaleChanged(() => changed = true);
        await service.setLocale("es");

        expect(service.currentLocale).toBe("es");
        expect(changed).toBe(true);

        expect(result.i18n.locale.value).toBe("es");
        expect(result.i18n.t("foo")).toBe("en-US");
    });

    test("change the current locale for loader that does not support the new locale or the fallback locale", async () => {
        const result = await setupComposition({
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => config.services.get(IVueI18nService).registerLoader(() => Promise.reject(new Error("Locale not supported.")))
        });

        const service = result.collection.services.get(IVueI18nService);

        // set the locale and make sure it doesn't fail
        await service.setLocale("es");
    });
});