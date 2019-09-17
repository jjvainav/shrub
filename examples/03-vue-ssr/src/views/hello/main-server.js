import { bootstrap, VueServerModule } from "@shrub/vue-server";
import HelloModule from "./module";

export default bootstrap({
    modules: [
        HelloModule,
        VueServerModule
    ]
});