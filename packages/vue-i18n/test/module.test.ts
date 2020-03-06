import Vue from "vue";
import { IServiceCollection, ModuleLoader } from "@shrub/core";
import { IVueI18nConfiguration, IVueI18nService, VueI18nModule } from "../src";

describe("module", () => {
    test("verify vue-i18n installation", async () => {
        await ModuleLoader.load([VueI18nModule]);

        const instance = new Vue();
        expect(instance.$i18n).toBeDefined();
    });

    test("get message for default locale", async () => {
        await ModuleLoader.load([{
            name: "test",
            dependencies: [VueI18nModule],
            configure: ({ config }) => {
                config.get(IVueI18nConfiguration).register({
                    "en-US": { hi: "hi" },
                    "es": { hi: "hola" }
                });
            }
        }]);

        const instance = new Vue();
        expect(instance.$t("hi")).toBe("hi");
    });

    test("merge messages from multiple modules", async () => {
        await ModuleLoader.load([
            {
                name: "test",
                dependencies: [VueI18nModule],
                configure: ({ config }) => {
                    config.get(IVueI18nConfiguration).register({
                        "en-US": { foo: "foo" }
                    });
                }
            },
            {
                name: "test 2",
                dependencies: [VueI18nModule],
                configure: ({ config }) => {
                    config.get(IVueI18nConfiguration).register({
                        "en-US": { bar: "bar" }
                    });
                }
            }
        ]);

        const instance = new Vue();
        expect(instance.$t("foo")).toBe("foo");
        expect(instance.$t("bar")).toBe("bar");
    });

    test("changing the current locale", async () => {
        let changed: boolean | undefined;
        let services: IServiceCollection | undefined;
        await ModuleLoader.load([{
            name: "test",
            dependencies: [VueI18nModule],
            configure: config => {
                services = config.services;
                config.services.get(IVueI18nService).registerLoader(options => Promise.resolve({
                    foo: options.locale
                }));
            }
        }]);

        services!.get(IVueI18nService).onLocaleChanged(() => changed = true);
        await services!.get(IVueI18nService).setLocale("es");

        expect(services!.get(IVueI18nService).currentLocale).toBe("es");
        expect(changed).toBe(true);

        const instance = new Vue();
        expect(instance.$i18n.locale).toBe("es");
        expect(instance.$t("foo")).toBe("es");
    });
});