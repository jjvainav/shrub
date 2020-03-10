import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration, Singleton } from "@shrub/core";
import { VueModule } from "@shrub/vue";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import Vue from "vue";
import VueI18n, { IVueI18n } from "vue-i18n";

declare module "vue/types/vue" {
    interface Vue {
        readonly $i18n: VueI18n & IVueI18n;
        $t: typeof VueI18n.prototype.t;
        $tc: typeof VueI18n.prototype.tc;
        $te: typeof VueI18n.prototype.te;
        $d: typeof VueI18n.prototype.d;
        $n: typeof VueI18n.prototype.n;
    }
}

Vue.use({
    install(vue: typeof Vue) {
        Vue.mixin({
            beforeCreate: function() {
                this.$options.i18n = this.$options.i18n || getInstance();
            }
        });

        VueI18n.install(vue);
    }
});

export const IVueI18nConfiguration = createConfig<IVueI18nConfiguration>();
export const IVueI18nService = createService<IVueI18nService>("vue-i18n");

export type TranslateValues = VueI18n.Values;

export interface IVueI18nConfiguration {
    /** Registers a static set of locale messages or a loader that will load locale messages asynchronously. */
    register(messagesOrLoader: ILocaleMessages | ILocaleLoader): void;
}

export interface IVueI18nService {
    /** The current locale. */
    readonly currentLocale: string;
    /** An event that is raised when the current locale has changed. */
    readonly onLocaleChanged: IEvent;
    /** 
     * Register a callaback that will handle loading messages for a locale. 
     * Multiple loaders may be registered and the resulting messages will be merged together.
     */
    registerLoader(loader: ILocaleLoader): void;
    /** Sets and loads the current locale as a language/country code value (e.g. en-US). */
    setLocale(locale: string, path?: string): Promise<void>;
    /** Localize the message with the provided key representing a path in the current locale messages. */
    translate(key: string, values?: TranslateValues): string;
}

export interface IVueI18nSettings {
    /** The locale to set after loading all the modules; the default is en-US. */
    readonly locale?: string;
}

/** Defines a set of options for loading locale data. */
export interface ILocaleLoaderOptions {
    /** The locale to load. */
    readonly locale: string;
    /** An optional path identifying the current route being loaded. */
    readonly path?: string;
}

/** 
 * A callback that handles loading messages asynchronously for a given locale. The result can be a local messages object
 * or an es compatible module for async import support (e.g. import(./locales/en.js)).
 */
export interface ILocaleLoader {
    (options: ILocaleLoaderOptions): Promise<ILocaleMessageObject | IEsModuleLocalMessages>;
}

export interface ILocaleMessages extends VueI18n.LocaleMessages {
}

export interface ILocaleMessageObject extends VueI18n.LocaleMessageObject {
}

/** Represents a set of locale messages loaded from an es compatible module. */
export interface IEsModuleLocalMessages { 
    readonly default: ILocaleMessageObject;
}

interface ILocalLoaderInvoker {
    (options: ILocaleLoaderOptions): Promise<void>;
}

/** Gets the global instance of the i18n object. */
const getInstance = (function () {
    let i18n: VueI18n;
    let initializing = false;

    return () => {
        if (!i18n && !initializing) {
            initializing = true;
            i18n = new VueI18n({
                // TODO: support module settings to control/define the fallback locale
                fallbackLocale: "en-US"
            });
            initializing = false;
        }

        return i18n;
    };
})();

export class VueI18nModule implements IModule {
    readonly name = "vue-i18n";
    readonly dependencies = [VueModule];
    
    initialize({ config }: IModuleInitializer): void {
        config(IVueI18nConfiguration).register(({ services }: IModuleConfigurator) => ({
            register: messagesOrLoader => {
                if (typeof messagesOrLoader === "function") {
                    services.get(IVueI18nService).registerLoader(messagesOrLoader);
                }
                else {
                    services.get(IVueI18nService).registerLoader(options => Promise.resolve(messagesOrLoader[options.locale] || {}));
                }
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IVueI18nService, VueI18nService);
    }

    configure({ next, services, settings }: IModuleConfigurator): Promise<void> {
        return next().then(() => services.get(IVueI18nService).setLocale(this.getLocale(settings)));
    }

    private getLocale(settings: IVueI18nSettings): string {
        if (settings.locale) {
            return settings.locale;
        }

        if (typeof document !== "undefined" && document.documentElement.lang) {
            return document.documentElement.lang;
        }

        return "en-US";
    }
}

@Singleton
class VueI18nService implements IVueI18nService {
    private readonly localeChanged = new EventEmitter("locale-changed");
    private readonly i18n = getInstance();
    private invoker?: ILocalLoaderInvoker;

    get currentLocale(): string {
        return this.i18n.locale;
    }

    get onLocaleChanged(): IEvent {
        return this.localeChanged.event;
    }

    registerLoader(loader: ILocaleLoader): void {
        const invoker = this.createInvoker(loader);
        const next = this.invoker;
        this.invoker = next
            ? options => invoker(options).then(() => next(options))
            : invoker;
    }

    async setLocale(locale: string, path?: string): Promise<void> {
        if (this.invoker) {
            await this.invoker({ locale, path });
        }

        this.i18n.locale = locale;
        this.localeChanged.emit();
    }

    translate(key: string, values?: TranslateValues): string {
        const result = this.i18n.t(key, values);
        if (typeof result === "object") {
            throw new Error(`Locale key (${key}) does not represent a string message.`);
        }

        return result;
    }

    private createInvoker(loader: ILocaleLoader): ILocalLoaderInvoker {
        // attempt's to load a locale and uses the specified fallback if the operation failed
        const tryLoadWithFallback = (options: ILocaleLoaderOptions, fallbackLocale?: string): Promise<void> => {
            return loader(options)
                .then(result => this.isEsModule(result) ? result.default : result)
                .then(message => this.i18n.mergeLocaleMessage(options.locale, message))
                .catch(() => {
                    if (fallbackLocale) {
                        return tryLoadWithFallback({ ...options, locale: fallbackLocale });
                    }

                    // this means the locale and fallback failed to load so just return a resolved promise instead of throwing the error
                    return Promise.resolve();
                });
        };

        // only pass down the fallback locale if it is not the same as the locale being loaded
        return options => tryLoadWithFallback(options, options.locale !== this.i18n.fallbackLocale ? this.i18n.fallbackLocale : undefined);
    }

    private isEsModule(obj: ILocaleMessageObject | IEsModuleLocalMessages): obj is IEsModuleLocalMessages {
        return (<any>obj).default !== undefined;
    }
}