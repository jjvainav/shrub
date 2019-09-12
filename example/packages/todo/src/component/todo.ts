import Vue from "vue";
import Component from "vue-class-component";
import { TodoModel } from "../model";

@Component({
    directives: {
        "todo-focus": function (el, binding) {
            if (binding.value) {
              el.focus()
            }
        }
    },
    filters: {
        pluralize: function (n: number) {
            return n === 1 ? 'item' : 'items'
        }
    }
})
export default class Todo extends Vue {
    newTodo = "";

    readonly model = new TodoModel();

    createTodo(): void {
        if (this.newTodo) {
            this.model.addTodo(this.newTodo);
            this.newTodo = "";
        }
    }

    hasItems(): boolean {
        return this.model.items.length > 0;
    }
}