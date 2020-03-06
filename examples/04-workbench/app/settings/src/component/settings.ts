import { ILocaleService } from "@app/workbench";
import Vue from "vue";
import Component from "vue-class-component";

@Component
export default class Settings extends Vue {
    isEnglish = false;
    isSpanish = false;

    created(): void {
        this.updateState();
    }

    setLocale(locale: string): void {
        this.$services.get(ILocaleService).setLocale(locale).then(() => this.updateState());
    }

    private updateState(): void {
        const locale = this.$services.get(ILocaleService).currentLocale;
        this.isEnglish = locale === "en-US";
        this.isSpanish = locale === "es";
    }
}