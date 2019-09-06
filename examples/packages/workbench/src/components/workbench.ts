import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { IWorkbenchModel } from "../model";
import Sidebar from "./sidebar.vue";
import Toolbar from "./toolbar.vue";

@Component({
    components: {
        Sidebar,
        Toolbar
    }
})
export default class Workbench extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;
}