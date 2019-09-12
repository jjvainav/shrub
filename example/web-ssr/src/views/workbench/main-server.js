import { IntroModule } from "@example/intro";
import { TodoModule } from "@example/todo";
import { WorkbenchModule } from "@example/workbench";
import { bootstrap, VueServerModule } from "@shrub/vue-server";

export default bootstrap({
    modules: [
        IntroModule,
        TodoModule,
        VueServerModule,
        WorkbenchModule
    ],
    settings: {
        workbench: {
            defaultExample: "intro"
        }
    }
});