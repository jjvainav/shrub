import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { IWorkbenchModel } from "../model";
import { IWorkbenchMenuItem, IWorkbenchService } from "../services";
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

@Component({
    components: {
        Logo,
        SidebarItem
    }
})
export default class Sidebar extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;

    menuItems!: IMenuItem[];

    created(): void {
        this.menuItems = [];

        for (const example of this.$services.get(IWorkbenchService).getExamples()) {
            this.menuItems.push({
                item: example.menu,
                link: example.name
            });
        }

        this.menuItems.sort(orderComparer);
    }
}