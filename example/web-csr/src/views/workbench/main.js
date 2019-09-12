import { IntroModule } from "@example/intro";
import { TodoModule } from "@example/todo";
import { WorkbenchModule } from "@example/workbench";
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