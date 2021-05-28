import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { RawLocation } from "vue-router";
import { IWorkbenchModel } from "../model";
import { IWorkbenchMenuItem, IWorkbenchService } from "../services";

@Component
export default class SidebarItem extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;
    @Prop({ required: true }) item!: IWorkbenchMenuItem;
    @Prop({ required: true }) link!: string;

    getLocation(): RawLocation {
        return { name: this.link };
    }

    getTitle(): string {
        return typeof this.item.title === "function"
            ? this.$services.get(IWorkbenchService).getLocaleString(this.item.title)
            : this.item.title;
    }
}