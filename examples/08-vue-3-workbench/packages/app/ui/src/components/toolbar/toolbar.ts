import { defineComponent, h, PropType } from "vue";

export type ToolbarJustifyContent = "start" | "center" | "end" | "between" | "around";

export const ToolbarList = defineComponent({
    setup: (_, context) => () => h("ul", { class: ["navbar-nav"] }, context.slots)
});

export const ToolbarListItem = defineComponent({
    setup: (_, context) => () => h("li", { class: ["nav-item"] }, context.slots)
});

export const Toolbar = defineComponent({
    props: {
        justifyContent: { type: String as PropType<ToolbarJustifyContent> }
    },
    setup: (props, context) => () => h("nav", {
            class: ["navbar", "navbar-light", "toolbar", "flex-md-nowrap"]
        },
        [h("div", {
            class: ["container-fluid", "p-0", props.justifyContent ? { [`justify-content-${props.justifyContent}`]: true } : {}]
        },
        context.slots)])
    });