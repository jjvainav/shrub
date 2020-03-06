import { ILocaleMessages } from "@shrub/vue-i18n";

export interface IExampleLocale extends ILocaleMessages {
    readonly todo: {
        readonly example: {
            readonly title: string;
        }
    };
}