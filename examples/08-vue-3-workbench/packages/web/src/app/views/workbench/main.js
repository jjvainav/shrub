import { IntroModule } from "@app/intro";
import { SettingsModule } from "@app/settings";
import { WorkbenchModule } from "@app/workbench";
import { ModuleLoader } from "@shrub/core";
import { VueModule } from "@shrub/vue-3";

ModuleLoader.load({
    modules: [
        IntroModule,
        SettingsModule,
        VueModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "intro"
        }
    }
});