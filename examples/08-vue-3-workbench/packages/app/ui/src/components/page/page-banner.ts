import { defineComponent, h } from "vue";

/** A container for a page banner that will be fixed to the top of the page. */
export default defineComponent({
    setup: (_, context) => h("div", { class: ["page-banner"] }, context.slots)
});