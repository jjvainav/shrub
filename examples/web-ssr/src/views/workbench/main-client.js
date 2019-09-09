import { HelloWorldModule } from "@examples/01-hello-world";
import { WorkbenchModule } from "@examples/workbench";
import { loadModules } from "@shrub/module";
import { VueModule } from "@shrub/vue";

loadModules({
    modules: [
        HelloWorldModule,
        VueModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "01-hello-world"
        }
    }
});