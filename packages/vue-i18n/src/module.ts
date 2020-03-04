import { createService, IModule, IServiceRegistration, Singleton } from "@shrub/core";
import { VueModule } from "@shrub/vue";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import merge from "lodash.merge";
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

Vue.use(VueI18n);

export const IVueI18nService = createService<IVueI18nService>("vue-i18n");

export interface IVueI18nService {
    /** The current locale. */
    readonly currentLocale: string;
    /** An event that is raised when the current locale has changed. */
    readonly onLocaleChanged: IEvent;
    /** 
     * Register a callaback that will handle loading messages for a locale. 
     * Multiple loaders may be registered and the resulting messages will be merged together.
     */
    registerLoader(loader: ILanguageLoader): void;
    /** Sets and loads the current locale as a language/country code value (e.g. en-US). */
    setLocale(locale: string, path?: string): Promise<void>;
}

/** Defines a set of options for loading a language data. */
export interface ILanguageLoaderOptions {
    /** The locale to load. */
    readonly locale: string;
    /** An optional path identifying the current route being loaded. */
    readonly path?: string;
}

/** 
 * A callback that handles loading messages for a given locale. The result can be a local messages object
 * or a es compatible module for async import support (e.g. import(./locales/en.js)).
 */
export interface ILanguageLoader {
    (options: ILanguageLoaderOptions): Promise<ILocaleMessages | IEsModuleLocalMessages>;
}

export interface ILocaleMessages extends VueI18n.LocaleMessageObject {
}

/** Represents a set of locale messages loaded from an es compatible module. */
export interface IEsModuleLocalMessages { 
    readonly default: ILocaleMessages;
}

// TODO: this needs to be injected when creating the Vue app
// TODO: update Vue module configuration to support injecting options that get merged together?
const i18n = new VueI18n({
    // TODO: best way to set current locale on load?
    locale: "en-US",
    fallbackLocale: "en-US"
});

export class VueI18nModule implements IModule {
    readonly name = "vue-i18n";
    readonly dependencies = [VueModule];
    
    configureServices(registration: IServiceRegistration): void {
        registration.register(IVueI18nService, VueI18nService);
    }
}

@Singleton
class VueI18nService implements IVueI18nService {
    private readonly localeChanged = new EventEmitter("locale-changed");
    private loader?: (options: ILanguageLoaderOptions) => Promise<ILocaleMessages>;

    get currentLocale(): string {
        return i18n.locale;
    }

    get onLocaleChanged(): IEvent {
        return this.localeChanged.event;
    }

    registerLoader(loader: ILanguageLoader): void {
        const next = this.loader;
        this.loader = next
            ? options => loader(options).then(async result => this.mergeMessages(result, await next(options)))
            : options => loader(options).then(result => this.isEsModule(result) ? result.default : result);
    }

    async setLocale(locale: string, path?: string): Promise<void> {
        // TODO: cache loaded locale messages

        const message = this.loader ? await this.loader({ locale, path }) : {};
        i18n.setLocaleMessage(locale, message);
        i18n.locale = locale;
        this.localeChanged.emit();
    }

    private mergeMessages(lhs: ILocaleMessages | IEsModuleLocalMessages, rhs: ILocaleMessages | IEsModuleLocalMessages): ILocaleMessages {
        const m1 = this.isEsModule(lhs) ? lhs.default : lhs;
        const m2 = this.isEsModule(rhs) ? rhs.default : rhs;
        return merge({}, m1, m2);
    }

    private isEsModule(obj: ILocaleMessages | IEsModuleLocalMessages): obj is IEsModuleLocalMessages {
        return (<any>obj).default !== undefined;
    }
}