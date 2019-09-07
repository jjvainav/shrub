import { HelloWorldModule } from "@examples/01-hello-world";
import { WorkbenchModule } from "@examples/workbench";
import { bootstrap, VueServerModule } from "@shrub/vue-server";

export default bootstrap({
    modules: [
        HelloWorldModule,
        VueServerModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "01-hello-world"
        }
    }
});