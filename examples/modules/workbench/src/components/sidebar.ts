import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { IWorkbenchMenuItem, IWorkbenchService, orderComparer } from "@app/workbench";
import { IWorkbenchModel } from "../model";
import Logo from "./logo.vue";
import SidebarItem from "./sidebar-item.vue";

@Component({
    components: {
        Logo,
        SidebarItem
    }
})
export default class Sidebar extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;

    menuItems!: IWorkbenchMenuItem[];

    created(): void {
        const service = this.$services.get(IWorkbenchService);

        this.menuItems = [];
        for (const app of service.getApps()) {
            if (app.menu) {
                for (const item of app.menu) {
                    if (!item.link.name) {
                        // TODO: add support for non-named routes? - if so, the sidebar-item will also need to be updated
                        throw new Error("Menu items can only link to named routes");
                    }

                    this.menuItems.push(item);
                }
            }
        }

        this.menuItems.sort(orderComparer);
    }
}