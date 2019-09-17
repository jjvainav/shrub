import Vue from "vue";
import Component from "vue-class-component";
import { Prop } from "vue-property-decorator";
import { IWorkbenchModel } from "../model";

@Component
export default class Toolbar extends Vue {
    @Prop({ required: true }) model!: IWorkbenchModel;
}