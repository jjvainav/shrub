// NOTE: this package is being built using an older version of typescript because of an issue with vue-i18n not working with typescript version 5
// https://github.com/intlify/vue-i18n-next/issues/1415

import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { Composer, createI18n, I18n, I18nMode, LocaleMessageDictionary, LocaleMessages, VueI18n } from "vue-i18n";

export const IVueI18nConfiguration = createConfig<IVueI18nConfiguration>();
export const IVueI18nService = createService<IVueI18nService>("vue-i18n");

export interface IVueI18nConfiguration {
    /** Registers a static set of locale messages or a loader that will load locale messages asynchronously. */
    register(messagesOrLoader: ILocaleMessages | ILocaleLoader): void;
}

export interface IVueI18nModuleSettings {
    /** 
     * True to enable legacy mode for the vue-i18n package. Set this to true when your Vue components use the old Options Api
     * or false when using the Composition Api. This is false by default.
     */
    readonly legacy?: boolean;
    /** The locale to set after loading all the modules; the default is en-US. */
    readonly locale?: string;
}

export interface IVueI18nService {
    /** The current locale. */
    readonly currentLocale: string;
    /** An event that is raised when the current locale has changed. */
    readonly onLocaleChanged: IEvent;
    /** Manually loads messages based on the current locale. */
    load(loader: ILocaleLoader): Promise<void>;
    /** 
     * Register a callaback that will handle loading messages for a locale. 
     * Multiple loaders may be registered and the resulting messages will be merged together.
     */
    registerLoader(loader: ILocaleLoader): void;
    /** Sets and loads the current locale as a language/country code value (e.g. en-US). */
    setLocale(locale: string, path?: string): Promise<void>;
    /** Localize the message with the provided key representing a path in the current locale messages and optional named values. */
    translate(key: string, named?: Record<string, unknown>): string;
    /** Localize the message with the provided key representing a path in the current locale messages and optional list of values. */
    translate(key: string, list?: unknown[]): string;
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

export interface ILocaleMessages extends LocaleMessages<any> {
}

export type ILocaleMessageObject = LocaleMessageDictionary<any>;

/** Represents a set of locale messages loaded from an es compatible module. */
export interface IEsModuleLocalMessages { 
    readonly default: ILocaleMessageObject;
}

interface ILocalLoaderInvoker {
    (options: ILocaleLoaderOptions): Promise<void>;
}

export class VueI18nModule implements IModule {
    private i18n?: I18n<{}, {}, {}, string, true>;

    readonly name = "vue-i18n";
    readonly dependencies = [VueModule];
    
    initialize({ config }: IModuleInitializer): void {
        config(IVueI18nConfiguration).register(({ services }: IModuleConfigurator) => ({
            register: messagesOrLoader => {
                if (typeof messagesOrLoader === "function") {
                    services.get(IVueI18nService).registerLoader(<ILocaleLoader>messagesOrLoader);
                }
                else {
                    services.get(IVueI18nService).registerLoader(options => Promise.resolve(messagesOrLoader[options.locale] || {}));
                }
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.registerSingleton(IVueI18nService, { create: () => new VueI18nService(this.i18n!.global, this.i18n!.mode) });
    }

    configure({ config, next, services, settings }: IModuleConfigurator): Promise<void> {
        const legacy = (<IVueI18nModuleSettings>settings).legacy === true;
        const locale = this.getLocale(settings);
        this.i18n = createI18n({ fallbackLocale: locale, legacy });
        config.get(IVueConfiguration).configure(app => app.use(this.i18n!));
        return next().then(() => services.get(IVueI18nService).setLocale(locale));
    }

    private getLocale(settings: IVueI18nModuleSettings): string {
        if (settings.locale) {
            return settings.locale;
        }

        if (typeof document !== "undefined" && document.documentElement.lang) {
            return document.documentElement.lang;
        }

        return "en-US";
    }
}

class VueI18nService implements IVueI18nService {
    private readonly localeChanged = new EventEmitter();
    private invoker?: ILocalLoaderInvoker;

    constructor(
        private readonly i18n: VueI18n,
        private readonly mode: I18nMode) {
    }

    get currentLocale(): string {
        return this.getLocale();
    }

    get onLocaleChanged(): IEvent {
        return this.localeChanged.event;
    }

    load(loader: ILocaleLoader): Promise<void> {
        const invoker = this.createInvoker(loader);
        return invoker({ locale: this.getLocale() });
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
            await this.invoker({ locale, path: path && this.normalizePath(path) });
        }

        if (this.mode === "legacy") {
            this.i18n.locale = locale;
        }
        else {
            (<Composer><unknown>this.i18n).locale.value = locale;
        }
        
        this.localeChanged.emit();
    }

    translate(key: string, named?: Record<string, unknown>): string;
    translate(key: string, list?: unknown[]): string;
    translate(key: string, namedOrList?: Record<string, unknown> | unknown[]): string {
        const result = this.i18n.t(key, <any>namedOrList);
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

        return options => {
            // only pass down the fallback locale if it is not the same as the locale being loaded
            const fallback = this.getFallbackLocale();
            return tryLoadWithFallback(options, options.locale !== fallback ? fallback : undefined);
        }
    }

    private getFallbackLocale(): string | undefined {
        if (typeof this.i18n.fallbackLocale === "string") {
            return this.i18n.fallbackLocale;
        }

        if (Array.isArray(this.i18n.fallbackLocale)) {
            return this.i18n.fallbackLocale.length ? this.i18n.fallbackLocale[0] : undefined;
        }

        if (typeof this.i18n.fallbackLocale === "object") {
            for (const key of Object.keys(this.i18n.fallbackLocale)) {
                if (this.i18n.fallbackLocale[key].length) {
                    return this.i18n.fallbackLocale[key][0];
                }
            }
        }

        return undefined;
    }

    private getLocale(): string {
        // when using composition mode the locale is wrapped as a ref
        return this.mode === "legacy" ? this.i18n.locale : (<Composer><unknown>this.i18n).locale.value;
    }

    private isEsModule(obj: ILocaleMessageObject | IEsModuleLocalMessages): obj is IEsModuleLocalMessages {
        return (<any>obj).default !== undefined;
    }

    private normalizePath(path: string): string {
        path = path.startsWith("/") ? path : "/" + path;
        while (path.endsWith("/")) {
            path = path.substr(0, path.length - 1);
        }
        return path;
    }
}