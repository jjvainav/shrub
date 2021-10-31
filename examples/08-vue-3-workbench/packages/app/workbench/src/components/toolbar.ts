import { defineComponent, PropType } from "vue";
import { IWorkbenchModel } from "../model";

export default defineComponent({
    props: { 
        model: { type: Object as PropType<IWorkbenchModel>, required: true } 
    }
});