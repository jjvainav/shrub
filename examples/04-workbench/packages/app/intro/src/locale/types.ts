import { ILocaleMessageObject } from "@shrub/vue-i18n";

export interface IIntroLocale extends ILocaleMessageObject {
    readonly intro: {
        readonly title: string;
    };
}