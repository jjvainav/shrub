import { useServices } from "@shrub/vue-3";
import { defineComponent, PropType } from "vue";
import { RouteLocationRaw } from "vue-router";
import { IWorkbenchModel } from "../model";
import { IWorkbenchMenuItem, IWorkbenchService } from "../services/workbench";

export default defineComponent({
    props: {
        model: { type: Object as PropType<IWorkbenchModel>, required: true },
        item: { type: Object as PropType<IWorkbenchMenuItem>, required: true },
        link: { type: String, required: true }
    },
    setup: props => {
        const services = useServices();

        return {
            getLocation: (): RouteLocationRaw =>  ({ name: props.link }),
            getTitle: () => typeof props.item.title === "function"
                ? services.get(IWorkbenchService).getLocaleString(props.item.title)
                : props.item.title
        };
    }
});