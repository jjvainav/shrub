import { createService, Transient } from "@shrub/core";
import { IWorkbenchService } from "./workbench";

export const ILocaleService = createService<ILocaleService>("workbench-locale-service");

export interface ILocaleService {
    readonly currentLocale: string;
    setLocale(locale: string): Promise<void>;
}

@Transient
export class LocaleService implements ILocaleService {
    constructor(@IWorkbenchService private readonly workbenchService: IWorkbenchService) {
    }

    get currentLocale(): string {
        return this.workbenchService.currentLocale;
    }

    setLocale(locale: string): Promise<void> {
        return this.workbenchService.setLocale(locale);
    }
}