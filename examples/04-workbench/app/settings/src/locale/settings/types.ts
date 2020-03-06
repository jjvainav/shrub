import { ILocaleMessages } from "@shrub/vue-i18n";

export interface ISettingsLocale extends ILocaleMessages {
    readonly settings: {
        readonly locales: {
            readonly englishUS: string;
            readonly spanish: string;
        }
    };
}