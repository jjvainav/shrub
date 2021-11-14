import { ModuleLoader } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import { IVueI18nConfiguration, VueI18nModule } from "@shrub/vue-3-i18n";
import Main from "./main.vue";

ModuleLoader
    .useSettings({ "vue-i18n": { locale: "en-US" } })
    .useModules([{
        name: "main",
        dependencies: [
            VueModule,
            VueI18nModule
        ],
        configure: ({ config }) => {
            config.get(IVueI18nConfiguration).register(({ locale }) => import(/* webpackChunkName: "main.locale.[request]" */ `./messages.${locale}`))
            config.get(IVueConfiguration).mount(Main);
        }
    }])
    .load();