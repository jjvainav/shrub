import { DOMEventEmitter } from "@sprig/event-emitter-dom";
import { defineComponent, h, onBeforeUnmount, onMounted, PropType, ref, Ref, VNode, VNodeArrayChildren } from "vue";
import { isTextVNode } from "../../utils/vnode";

export type PageHeaderBorderVisibility = "hidden" | "visible" | "auto";

/** 
 * A component for rendering a page's header and there are a few different ways this can be used: 
 * 1) Supply a text value for the component's slot and that will be rendered as the header's title.
 * 2) Provide a title and optional subtitle properties to render a standard title/subtitle header.
 * 3) Actions can be provided by using the 'actions' named slot; it is also recommended to use a toolbar for the actions.
 * 4) For more complex headers, provide a non-text slot; for proper styling, use the predefined page-header css classes.
 */

 function createTitleElement(title?: string | VNode, subtitle?: string): VNode {
    // note: intentially not using the BS flex layout classes below so that anyone using the page-header__* classes won't need to worry about flex

    const children: VNodeArrayChildren = [];

    if (title) {
        children.push(h("div", { class: ["page-header-title"] }, [h("h2", { class: ["mb-0"] }, [title])]));
    }

    if (subtitle) {
        children.push(h("div", { class: ["page-header-subtitle"] }, [h("h5", { class: ["mb-0"] }, [title])]));
    }

    return h("div", { class: ["page-header-title-container"] }, children);
}

export default defineComponent({
    props: {
        title: { type: String },
        subtitle: { type: String },
        borderVisibility: { type: String as PropType<PageHeaderBorderVisibility>, default: "auto" },
        sticky: { type: Boolean, default: false }
    },
    setup: (props, context) => {
        const root = ref() as Ref<HTMLElement>;
        const showBorder = ref(props.borderVisibility === "visible");
        const scroll = new DOMEventEmitter("page-scroll", "scroll");

        onBeforeUnmount(() => scroll.unbindTarget());

        onMounted(() => {
            if (props.borderVisibility === "auto") {
                // it's expected that the header will be sticky and 'scroll away' the padding before being stuck to its parent
                // the logic below will detect when it gets stuck and automatically show the border 
                const header = root.value;
                const parent = header.parentElement!;
    
                const padding = typeof window !== "undefined"
                    ? parseFloat(window.getComputedStyle(header).paddingTop)
                    : 0;
                
                scroll.bindTarget(parent);
                scroll.event(() => showBorder.value = parent.scrollTop >= padding);
            }
        });

        return () => {
            const actions = context.slots.actions && context.slots.actions() || [];
            let children = context.slots.default && context.slots.default() || [];

            if (!children.length) {
                children = [createTitleElement(props.title, props.subtitle)];
            }
            else if (children.length === 1 && isTextVNode(children[0])) {
                children = [createTitleElement(children[0])];
            }
    
            if (actions.length) {
                children.push(h("div", { class: ["page-header-actions"] }, actions));
            }
    
            return h("div", { 
                ref: root,
                class: ["page-header", "d-flex", "flex-row", "align-items-center", { 
                    "page-header-border": showBorder.value,
                    "page-header-sticky": props.sticky 
                }]
            }, 
            children); 
        };
    }
});