import { defineComponent, h } from "vue";

/** A container for the main content in a page. */
export default defineComponent({
    props: { fill: { type: Boolean, default: false } },
    setup: (props, context) => h("div", { class: ["page-content", { "flex-fill": props.fill }] }, context.slots)
});