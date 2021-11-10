import { Comment, defineComponent, h, PropType, reactive, VNodeArrayChildren, watch } from "vue";
import { RouteLocationNormalized, useRoute } from "vue-router";

/** Represents an item in the sidebar. */
export interface ISidebarItem {
    /** A boostrap icon for the sidebar item. */
    readonly icon: string;
    /** Route to navigate to when the item is clicked. */
    readonly path: string;
    /** Optional panel that is shown when the side bar item is active. */
    readonly panel?: ISidebarPanel;
}

/** Represents an optional sidebar panel to show when the sidebar item is active. */
export interface ISidebarPanel {
    /** A set of links to display. */
    readonly links?: ISidebarPanelLinkGroup[];
}

/** A group of links for the sidebar's content. */
export interface ISidebarPanelLinkGroup {
    readonly title: string;
    readonly links: ISidebarPanelLink[];
}

/** Represents a sub-link inside a sidebar panel.  */
export interface ISidebarPanelLink {
    readonly label: string;
    /** Route to navigate to when the item is clicked; this is expected to be a child resource of the parent sidebar item. */
    readonly path: string;
}

export interface ISidebarPanelState {
    collapsed: boolean;
    panel?: ISidebarPanel;
}

export const SidebarBrand = defineComponent({
    props: {
        routeTo: { type: String, default: "/" }
    },
    setup: (props, context) => () => h("router-link", { 
        class: ["sidebar-brand"],
        props: { to: props.routeTo }
    }, 
    context.slots)
});

export const SidebarPanel = defineComponent({
    props: {
        state: { required: true, type: Object as PropType<ISidebarPanelState> }
    },
    setup: props => {
        const route = useRoute();
        return () => {
            if (!props.state.panel) {
                return h(Comment, "");
            }

            const children: VNodeArrayChildren = [];
            
            if (props.state.panel.links) {
                for (const group of props.state.panel.links) {
                    children.push(h("div", { class: ["h6", "sidebar-panel-group-title"] }, group.title));
    
                    for (const link of group.links) {
                        children.push(h("router-link", {
                            staticClass: "sidebar-panel-link",
                            class: ["sidebar-panel-link", { "active": isSubResource(link.path, route.path) }],
                            props: { to: link.path }
                        },
                        link.label));
                    }
                }
            }
    
            return h("div", { class: ["sidebar-panel", { collapsed: props.state.collapsed }] }, children);
        };
    }
});

const SidebarItem = defineComponent({
    props: {
        item: { type: Object as PropType<ISidebarItem>, required: true } 
    },
    setup: props => {
        const route = useRoute();
        return () => {
            const icon = h("i", { class: [props.item.icon, "sidebar-item-icon"] });
            const link = h("router-link", {
                class: ["sidebar-item-link"],
                props: { to: props.item.path }
            }, 
            [icon]);
    
            const isActive = () => isSubResourceOfItem(props.item, route.path);
            return h("div", { class: ["sidebar-item", { "active": isActive() }] }, [link]);
        };
    }
});

function isSubResource(parent: string, sub: string): boolean {
    // in terms of REST API consider a parent /resource and sub-resource /resource/sub
    // this also returns true if they are the same
    return sub.startsWith(parent);
}

function isSubResourceOfItem(item: ISidebarItem, path: string): boolean {
    if (item.path === path) {
        return true;
    } 

    // only compare with the item's panel as those are expected to be sub resources
    if (item.panel && item.panel.links) {
        for (const group of item.panel.links) {
            for (const link of group.links) {
                // check if the paths are equal or if the path is a sub-resources of the link path
                if (isSubResource(link.path, path)) {
                    return true;
                }
            }
        }
    }

    return false;
}

export default defineComponent({
    components: { 
        SidebarItem,
        SidebarPanel
    },
    props: {
        panelState: { type: Object as PropType<ISidebarPanelState> },
        items: { type: Array as PropType<Array<ISidebarItem>>, default: () => [] }
    },
    setup: props => {
        const route = useRoute();
        const state: ISidebarPanelState = props.panelState || reactive({
            collapsed: false,
            panel: undefined,
        });

        function getToggleIconClass(): object { 
            return { 
                "bi-chevron-double-left": !state.collapsed, 
                "bi-chevron-double-right": state.collapsed 
            };
        }

        function hasPanel(): boolean {
            return !!state.panel;
        }

        function togglePanel(): void {
            state.collapsed = !state.collapsed;
        }

        function updateSidebarPanelForRoute(route: RouteLocationNormalized): void {
            for (const item of props.items) {
                if (isSubResourceOfItem(item, route.path)) {
                    state.panel = item.panel;
                    state.collapsed = false;
                    break;
                }
            }
        }

        updateSidebarPanelForRoute(route);
        watch(route, to => updateSidebarPanelForRoute(to));
        
        return { state, getToggleIconClass, hasPanel, togglePanel };
    }
});