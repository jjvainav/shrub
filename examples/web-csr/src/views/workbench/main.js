import { HelloWorldModule } from "@examples/01-hello-world";
import { WorkbenchModule } from "@examples/workbench";
import { loadModules } from "@shrub/module";
import { VueBrowserModule } from "@shrub/vue-browser";

loadModules({
    modules: [
        HelloWorldModule,
        VueBrowserModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "01-hello-world"
        }
    }
});