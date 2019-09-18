import Vue from "vue";
import { IVueConfiguration, VueModule } from "@shrub/vue";

export default class HelloModule {
    constructor() {
        this.name = "hello";
        this.dependencies = [VueModule];
    }
    
    configure({ config }) {
        config.get(IVueConfiguration).mount(Vue.extend({ 
            template: '<div id="app"><h1>Hello Vue!</h1></div>' 
        }));
    }
}