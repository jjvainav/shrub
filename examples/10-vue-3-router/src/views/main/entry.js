import { ModuleLoader } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import { IVueRouterConfiguration, VueRouterModule } from "@shrub/vue-3-router";
import Hello from "./hello.vue";
import Root from "./root.vue";
import World from "./world.vue";

ModuleLoader.load({
    modules: [{
        name: "main",
        dependencies: [
            VueModule,
            VueRouterModule
        ],
        configure: ({ config }) => {
            const router = config.get(IVueRouterConfiguration);
            router.addRoute({ path: "/hello", component: Hello });
            router.addRoute({ path: "/world", component: World });

            config.get(IVueConfiguration).mount(Root);
        }
    }]
});