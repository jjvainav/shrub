import Vue from "vue";
import { IVueConfiguration, VueModule } from "@shrub/vue";

export default class HelloModule {
    name = "hello";
    dependencies = [VueModule];

    configure({ config }) {
        config.get(IVueConfiguration).mount(Vue.extend({ 
            template: "<h1>Hello Vue!</h1>" 
        }));
    }
}