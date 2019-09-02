import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { RawLocation } from "vue-router";
import { IWorkbenchMenuItem, IWorkbenchService, orderComparer } from "@app/workbench";
import { Query } from "@lib/queryable";
import { IWorkbenchModel } from "../model";

@Component({
    // name is needed for recursive components
    name: "SidebarItem"
})
export default class SidebarItem extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;
    @Prop({ required: true }) item!: IWorkbenchMenuItem;

    // this is mainly used to automatically open an item when navigating directly to a sub-item's url
    hasActiveChild = false;

    created(): void {
        const service = this.$services.get(IWorkbenchService);
        service.onRouteChanged(() => this.updateHasActiveChild(service));
        this.updateHasActiveChild(service);
    }

    hasChildren(item: IWorkbenchMenuItem): boolean {
        return item.children !== undefined && item.children.length > 0;
    }

    getChildClass(): Object {
        return {
            "workbench-sidebar-item--focus": this.hasChildren(this.item)
        };
    }

    getChildren(): IWorkbenchMenuItem[] {
        const items = [...(this.item.children || [])];
        items.sort(orderComparer);
        return items;
    }

    getLocation(item: IWorkbenchMenuItem): RawLocation {
        return {
            name: item.link.name,
            path: item.link.path,
            query: item.link.query,
            params: item.link.params
        }
    }

    onClick(): void {
        // an empty function used to stop the click event for item groups
        // the routing logic above handles opening/closing the item groups
    }

    private updateHasActiveChild(service: IWorkbenchService): void {
        // allow vuetify to update/refresh after a route change before toggling hasActiveChild
        // otherwise there seems to be an issue where the item does not open in random situations
        setTimeout(() => {
            this.hasActiveChild = this.hasChildren(this.item) && Query.any(this.item.children!, child => service.currentRoute.isMatch(child.link));
        }, 0);
    }
}