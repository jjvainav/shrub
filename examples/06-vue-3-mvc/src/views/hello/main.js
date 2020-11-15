import { defineComponent } from "vue";
import { ModuleLoader } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";

ModuleLoader.load({
    modules: [{
        name: "hello",
        dependencies: [VueModule],
        configure: ({ config }) => {
            config.get(IVueConfiguration).mount(defineComponent({ 
                template: "<h1>Hello Vue 3!</h1>" 
            }));
        }
    }]
});