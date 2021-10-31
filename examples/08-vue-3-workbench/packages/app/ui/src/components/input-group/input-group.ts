import { defineComponent, h } from "vue";

export default defineComponent({
    setup: (_, context) => () => h("div", { class: ["input-group"] }, context.slots)
});