import { IntroModule } from "@app/intro";
import { TodoModule } from "@app/todo";
import { WorkbenchModule } from "@app/workbench";
import { loadModules } from "@shrub/core";
import { VueModule } from "@shrub/vue";

loadModules({
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