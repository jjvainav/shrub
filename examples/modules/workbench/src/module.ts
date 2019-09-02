import Vue from "vue";
import Vuetify from "vuetify";
import { IModule } from "@shrub/module";
import "vuetify/dist/vuetify.css";

Vue.use(Vuetify);

export class WorkbenchModule extends IModule {
    readonly name = "workbench";
}