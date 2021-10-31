import { ComponentOptions, defineComponent, h, VNode } from "vue";
import PageBanner from "./page-banner";

function isPageBanner(node: VNode): boolean {
    return (<ComponentOptions>node.type).setup === PageBanner.setup;
}

/** Basic container for with common layout properties for a page's content. */
export default defineComponent({
    setup: (_, context) => {
        let children = context.slots.default && context.slots.default() || [];

        const banners: VNode[] = [];
        const content: VNode[] = [];

        for (const child of children) {
            if (isPageBanner(child)) {
                banners.push(child);
            }
            else {
                content.push(child);
            }
        }

        children = [h("div", { class: ["page-inner"] }, content)];
        if (banners.length) {
            banners.forEach(banner => children.unshift(banner));
        }

        return h("div", { class: ["page"] }, children);
    }
});