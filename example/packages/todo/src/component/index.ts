import { IComponent } from "@shrub/vue";
import TodoComponent from "./todo.vue";

const component: IComponent = {
    id: "todo",
    ctor: TodoComponent
};

export default component;