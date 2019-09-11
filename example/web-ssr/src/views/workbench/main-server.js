import { IntroModule } from "@example/intro";
import { WorkbenchModule } from "@example/workbench";
import { bootstrap, VueServerModule } from "@shrub/vue-server";

export default bootstrap({
    modules: [
        IntroModule,
        VueServerModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "intro"
        }
    }
});