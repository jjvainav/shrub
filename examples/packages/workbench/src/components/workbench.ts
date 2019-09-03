import Vue from "vue";
import Component from "vue-class-component";
import { WorkbenchModel } from "../model";
import Sidebar from "./sidebar.vue";
import Toolbar from "./toolbar.vue";

@Component({
    components: {
        Sidebar,
        Toolbar
    }
})
export default class Workbench extends Vue {
    readonly model = new WorkbenchModel(this.$services);
}