import { ILocaleMessageObject } from "@shrub/vue-3-i18n";

export interface IMessages extends ILocaleMessageObject {
    readonly main: {
        readonly hello: string;
    }
}