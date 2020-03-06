import { ILocaleMessages } from "@shrub/vue-i18n";

export interface IContentLocale extends ILocaleMessages {
    readonly settings: {
        readonly content: {
            readonly englishUS: string;
            readonly spanish: string;
        }
    };
}