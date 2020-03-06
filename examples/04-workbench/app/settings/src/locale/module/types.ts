import { ILocaleMessages } from "@shrub/vue-i18n";

export interface IModuleLocale extends ILocaleMessages {
    readonly settings: {
        readonly module: {
            readonly title: string;
        }
    };
}