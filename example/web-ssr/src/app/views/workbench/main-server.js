import { IntroModule } from "@app/intro";
import { TodoModule } from "@app/todo";
import { WorkbenchModule } from "@app/workbench";
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