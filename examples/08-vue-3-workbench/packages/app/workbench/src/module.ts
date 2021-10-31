import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IModelService, ModelModule } from "@shrub/model";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import { VueI18nModule } from "@shrub/vue-3-i18n";
import { reactive } from "vue";
import { NotFoundComponent, WorkbenchComponent } from "./components";
import { WorkbenchModel } from "./model";
import { DisplayService, IDisplayService } from "./services/display";
import { ILocaleService, LocaleService } from "./services/locale";
import { IWorkbenchExample, IWorkbenchRouteConfig, IWorkbenchService, WorkbenchBrowserService } from "./services/workbench";
import * as utils from "./utils";

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
        config.get(IVueConfiguration).configure(app => app.use(workbenchService.router));
        config.get(IVueConfiguration).mount(WorkbenchComponent, {
            data: () => ({ props: { model: reactive(services.get(IModelService).get("workbench", WorkbenchModel)) } }),
            options: { router: workbenchService.router }
        });

        workbenchService.registerRoute({ path: "/404", component: { comp: NotFoundComponent } });
        workbenchService.registerRoute({ path: "/:pathMatch(.*)*", redirect: "/404" });
    }    
}