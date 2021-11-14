import { useService } from "@shrub/vue-3";
import { IVueI18nService } from "@shrub/vue-3-i18n";
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";

export default defineComponent({
    setup: () => {
        const i18n = useI18n();
        const service = useService(IVueI18nService);
        return { setLocale: (locale: string) => service.setLocale(locale), t: i18n.t };
    }
});