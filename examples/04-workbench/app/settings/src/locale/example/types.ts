import { ILocaleMessages } from "@shrub/vue-i18n";

export interface IExampleLocale extends ILocaleMessages {
    readonly settings: {
        readonly example: {
            readonly title: string;
        }
    };
}