import { ModuleLoader } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import Counter from "./counter.vue";

ModuleLoader.load({
    modules: [{
        name: "counter",
        dependencies: [VueModule],
        configure: ({ config }) => config.get(IVueConfiguration).mount(Counter)
    }]
});