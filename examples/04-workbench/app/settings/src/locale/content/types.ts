import { ILocaleMessageObject } from "@shrub/vue-i18n";

export interface IContentLocale extends ILocaleMessageObject {
    readonly settings: {
        readonly content: {
            readonly englishUS: string;
            readonly spanish: string;
        }
    };
}