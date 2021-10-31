import { defineComponent, PropType } from "vue";
import { IWorkbenchModel } from "../model";
import Sidebar from "./sidebar.vue";
import Toolbar from "./toolbar.vue";

// TODO: update workbench to use UI components

export default defineComponent({
    components: {
        Sidebar,
        Toolbar
    },
    props: { 
        model: { type: Object as PropType<IWorkbenchModel>, required: true } 
    }
});