import { useService } from "@shrub/vue-3";
import { defineComponent, PropType } from "vue";
import { IWorkbenchModel } from "../model";
import { IWorkbenchMenuItem, IWorkbenchService } from "../services/workbench";
import Logo from "./logo.vue";
import SidebarItem from "./sidebar-item.vue";

interface IMenuItem { 
    readonly link: string;
    readonly item: IWorkbenchMenuItem;  
}

const orderComparer = (lhs: IMenuItem, rhs: IMenuItem) => {
    if (lhs.item.order === rhs.item.order) {
        return 0;
    }

    if (lhs.item.order === undefined) {
        return 1;
    }

    if (rhs.item.order === undefined) {
        return -1;
    }

    if (lhs.item.order < rhs.item.order) { 
        return -1;
    }

    return 1;
};

export default defineComponent({
    components: {
        Logo,
        SidebarItem
    },
    props: {
        model: { type: Object as PropType<IWorkbenchModel>, required: true }
    },
    setup: () => ({
        menuItems: useService(IWorkbenchService).getExamples()
            .map(example => ({
                item: example.menu,
                link: example.name
            }))
            .sort(orderComparer)
    })
});