import { IComponent } from "@shrub/vue-core";
import HelloWorldComponent from "./hello-world.vue";

const component: IComponent = {
    id: "hello-world",
    ctor: HelloWorldComponent
};

export default component;