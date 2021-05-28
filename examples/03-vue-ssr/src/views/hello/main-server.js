import { bootstrap, VueServerModule } from "@shrub/vue-server";
import HelloModule from "./module";

export default bootstrap([
    HelloModule,
    VueServerModule
]);