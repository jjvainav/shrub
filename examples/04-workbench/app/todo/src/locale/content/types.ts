import { ILocaleMessages } from "@shrub/vue-i18n";

export interface IContentLocale extends ILocaleMessages {
    readonly todo: {
        readonly content: {
            readonly clearCompleted: string;
            readonly count: string;
            readonly filterActive: string;
            readonly filterAll: string;
            readonly filterCompleted: string;
            readonly footerInstructions: string;
            readonly footerInformation: string;
            readonly newTodoPlaceholder: string;
        }
    };
}