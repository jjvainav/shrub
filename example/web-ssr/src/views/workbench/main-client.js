import { IntroModule } from "@example/intro";
import { WorkbenchModule } from "@example/workbench";
import { loadModules } from "@shrub/core";
import { VueModule } from "@shrub/vue";

loadModules({
    modules: [
        IntroModule,
        VueModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "intro"
        }
    }
});