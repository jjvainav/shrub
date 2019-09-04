import { HelloWorldModule } from "@examples/01-hello-world";
import { WorkbenchModule } from "@examples/workbench";
import { bootstrap } from "@shrub/vue-server";

export default bootstrap([
    HelloWorldModule,
    WorkbenchModule
]);