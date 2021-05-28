import { ILocaleMessageObject } from "@shrub/vue-i18n";

export interface IExampleLocale extends ILocaleMessageObject {
    readonly settings: {
        readonly example: {
            readonly title: string;
        }
    };
}