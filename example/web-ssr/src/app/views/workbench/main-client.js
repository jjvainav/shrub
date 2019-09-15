import { IntroModule } from "@app/intro";
import { TodoModule } from "@app/todo";
import { WorkbenchModule } from "@app/workbench";
import { ModuleLoader } from "@shrub/core";
import { VueModule } from "@shrub/vue";

ModuleLoader.load({
    modules: [
        IntroModule,
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