import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IModelService, ModelModule } from "@shrub/model";
import { IVueConfiguration, VueModule } from "@shrub/vue";
import { VueI18nModule } from "@shrub/vue-i18n";
import Vue from "vue";
import Router from "vue-router";
import Vuetify from "vuetify";
import { NotFoundComponent, WorkbenchComponent } from "./components";
import { WorkbenchModel } from "./model";
import { DisplayService, IDisplayService, ILocaleService, IWorkbenchExample, IWorkbenchRouteConfig, IWorkbenchService, LocaleService, WorkbenchBrowserService } from "./services";
import * as utils from "./utils";

// import icons for Vuetify: https://vuetifyjs.com/en/framework/icons
import "material-design-icons-iconfont/dist/material-design-icons.css";
import "vuetify/dist/vuetify.css";
import "./styles/index.scss";

Vue.use(Router);
Vue.use(Vuetify);

export const IWorkbenchConfiguration = createConfig<IWorkbenchConfiguration>();
export interface IWorkbenchConfiguration {
    registerExample(example: IWorkbenchExample): void;
    registerRoute(route: IWorkbenchRouteConfig): void;
}

export interface IWorkbenchModuleSettings {
    readonly defaultExample?: string;
}

export class WorkbenchModule implements IModule {
    readonly name = "workbench";
    readonly dependencies = [
        ModelModule,
        VueModule,
        VueI18nModule
    ];

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
        registration.register(ILocaleService, LocaleService);
        registration.register(IWorkbenchService, WorkbenchBrowserService);
    }

    async configure({ config, services, next }: IModuleConfigurator): Promise<void> {
        // allow other modules the ability to configure the workbench before attempting to mount
        await next();
        
        const workbenchService = services.get(IWorkbenchService);
        config.get(IVueConfiguration).mount(WorkbenchComponent, {
            data: () => ({
                props: { 
                    model: Vue.observable(services.get(IModelService).get("workbench", WorkbenchModel))
                }
            }),
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