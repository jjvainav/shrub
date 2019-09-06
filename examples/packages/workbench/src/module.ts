import Vue from "vue";
import Router from "vue-router";
import Vuetify from "vuetify";
import { createConfigType, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/module";
import { IServiceRegistration } from "@shrub/service-collection";
import { IModelService, IVueConfiguration, VueCoreModule } from "@shrub/vue-core";
import { NotFoundComponent, WorkbenchComponent } from "./components";
import { WorkbenchModel } from "./model";
import { DisplayService, IDisplayService, IWorkbenchExample, IWorkbenchRouteConfig, IWorkbenchService, WorkbenchBrowserService } from "./services";
import * as utils from "./utils";

// import icons for Vuetify: https://vuetifyjs.com/en/framework/icons
import "material-design-icons-iconfont/dist/material-design-icons.css";
import "vuetify/dist/vuetify.css";
import "./styles/index.scss";

Vue.use(Router);
Vue.use(Vuetify);

export const IWorkbenchConfiguration = createConfigType<IWorkbenchConfiguration>("workbench");
export interface IWorkbenchConfiguration {
    registerExample(example: IWorkbenchExample): void;
    registerRoute(route: IWorkbenchRouteConfig): void;
}

export interface IWorkbenchModuleSettings {
    readonly defaultExample?: string;
}

export class WorkbenchModule implements IModule {
    readonly name = "workbench";
    readonly dependencies = [VueCoreModule];

    initialize(init: IModuleInitializer): void {
        init.config(IWorkbenchConfiguration).register(({ services, settings }: IModuleConfigurator) => ({
            registerExample: example => { 
                const service = services.get(IWorkbenchService);

                service.registerExample(example);
                if (example.name === settings.defaultExample) {
                    service.registerRoute({ path: "/", redirect: "/" + utils.toKebabCase(example.name) });
                }
            },
            registerRoute: route => services.get(IWorkbenchService).registerRoute(route)
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IDisplayService, DisplayService);
        registration.register(IWorkbenchService, WorkbenchBrowserService);
    }

    configure({ config, services }: IModuleConfigurator): void {
        const workbenchService = services.get(IWorkbenchService);
        config.get(IVueConfiguration).mount(WorkbenchComponent, {
            data: () => ({
                props: { 
                    model: services.get(IModelService).get("workbench", WorkbenchModel) 
                }
            }),
            options: {
                created: function (this: Vue) {
                    if (this.$vuetify) {
                        // update the breakpoints to match the values used by Vuetify
                        this.$services.get(IDisplayService).setBreakpoints({
                            extraSmall: this.$vuetify.breakpoint.thresholds.xs,
                            small: this.$vuetify.breakpoint.thresholds.sm,
                            medium: this.$vuetify.breakpoint.thresholds.md - this.$vuetify.breakpoint.scrollbarWidth,
                            large: this.$vuetify.breakpoint.thresholds.lg - this.$vuetify.breakpoint.scrollbarWidth
                        });
                    }
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