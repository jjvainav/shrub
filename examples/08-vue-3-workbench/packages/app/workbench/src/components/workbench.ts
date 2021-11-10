import { CSidebar, ISidebarItem } from "@app/ui/dist/components/sidebar";
import { CToolbar } from "@app/ui/dist/components/toolbar";
import { useService } from "@shrub/vue-3";
import { defineComponent, PropType } from "vue";
import { IWorkbenchModel } from "../model";
import { IWorkbenchExample, IWorkbenchMenuItem, IWorkbenchService } from "../services/workbench";
//import Sidebar from "./sidebar.vue";
//import Toolbar from "./toolbar.vue";

const orderComparer = (lhs: IWorkbenchExample, rhs: IWorkbenchExample) => {
    if (lhs.menu.order === rhs.menu.order) {
        return 0;
    }

    if (lhs.menu.order === undefined) {
        return 1;
    }

    if (rhs.menu.order === undefined) {
        return -1;
    }

    if (lhs.menu.order < rhs.menu.order) { 
        return -1;
    }

    return 1;
};

export default defineComponent({
    components: {
        CSidebar,
        CToolbar
    },
    props: { 
        model: { type: Object as PropType<IWorkbenchModel>, required: true } 
    },
    setup: props => {
        const examples = useService(IWorkbenchService).getExamples().sort(orderComparer);
        const items: ISidebarItem[] = examples.map(example => ({ 
            icon: example.menu.icon, 
            path: example.name 
        }));

        return {
            items
        }
    }
});