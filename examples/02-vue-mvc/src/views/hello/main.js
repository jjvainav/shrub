import Vue from "vue";
import { ModuleLoader } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue";

ModuleLoader.load({
    modules: [{
        name: "hello",
        dependencies: [VueModule],
        configure: ({ config }) => {
            config.get(IVueConfiguration).mount(Vue.extend({ 
                template: "<h1>Hello Vue!</h1>" 
            }));
        }
    }]
});