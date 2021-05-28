import { IntroModule } from "@app/intro";
import { SettingsModule } from "@app/settings";
import { TodoModule } from "@app/todo";
import { WorkbenchModule } from "@app/workbench";
import { ModuleLoader } from "@shrub/core";
import { VueModule } from "@shrub/vue";

ModuleLoader.load({
    modules: [
        IntroModule,
        SettingsModule,
        TodoModule,
        VueModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "intro"
        }
    }
});