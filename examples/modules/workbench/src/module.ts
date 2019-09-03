import Vue from "vue";
import Vuetify from "vuetify";
import { IModule, IModuleConfigurator } from "@shrub/module";
import { IServiceRegistration } from "@shrub/service-collection";
import { IVueConfiguration, VueCoreModule } from "@shrub/vue-core";
import { NotFoundComponent, WorkbenchComponent } from "./components";
import { DisplayService, IDisplayService, IWorkbenchService, WorkbenchBrowserService } from "./services";

// import icons for Vuetify: https://vuetifyjs.com/en/framework/icons
import "material-design-icons-iconfont/dist/material-design-icons.css";
import "vuetify/dist/vuetify.css";
import "./styles/index.scss";

Vue.use(Vuetify);

export class WorkbenchModule implements IModule {
    readonly name = "workbench";
    readonly dependencies = [VueCoreModule];

    configureServices(registration: IServiceRegistration): void {
        registration.register(IDisplayService, DisplayService);
        registration.register(IWorkbenchService, WorkbenchBrowserService);
    }

    configure({ config, services }: IModuleConfigurator): void {
        const workbenchService = services.get(IWorkbenchService);
        config.get(IVueConfiguration).mount(WorkbenchComponent, {
            options: {
                created: function (this: Vue) {
                    // update the breakpoints to match the values used by Vuetify
                    this.$services.get(IDisplayService).setBreakpoints({
                        extraSmall: this.$vuetify.breakpoint.thresholds.xs,
                        small: this.$vuetify.breakpoint.thresholds.sm,
                        medium: this.$vuetify.breakpoint.thresholds.md - this.$vuetify.breakpoint.scrollbarWidth,
                        large: this.$vuetify.breakpoint.thresholds.lg - this.$vuetify.breakpoint.scrollbarWidth
                    });
                },
                router: workbenchService.router
            }
        });

        // there seems to be an issue with vue-router and the '*' path - in order for it to 
        // work properly it must be registered last even though the docs say otherwise
        workbenchService.registerRoute({ path: "/404", component: { id: "404", ctor: NotFoundComponent } });
        workbenchService.registerRoute({ path: "*", redirect: "/404" });
    }    
}