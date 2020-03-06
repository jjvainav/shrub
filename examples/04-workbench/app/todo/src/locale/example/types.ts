import { ILocaleMessageObject } from "@shrub/vue-i18n";

export interface IExampleLocale extends ILocaleMessageObject {
    readonly todo: {
        readonly example: {
            readonly title: string;
        }
    };
}