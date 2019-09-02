import Vue, { ComponentOptions, VNodeData } from "vue";
import { IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/module";
import { IServiceRegistration } from "@shrub/service-collection";
import { IModelService, IVueConfiguration, IVueMountOptions, VueCoreModule } from "@shrub/vue-core";
import { BrowserModelService } from "./model-service";

export interface IVueBrowserModuleSettings {
    /** The element id to mount to; the default is #app. */
    readonly el?: string;
}

/** Vue module for browser based vue components. */
export class VueBrowserModule implements IModule {
    readonly name = "vue-browser";
    readonly dependencies = [VueCoreModule];

    initialize(init: IModuleInitializer): void {
        init.config(IVueConfiguration).register(({ settings, services }: IModuleConfigurator) => ({
            mount: (component, options) => {
                const el = this.getElementId(settings);
                if (!document.getElementById(el.substr(1))) {
                    throw new Error(`Element with id (${el}) not found`);
                }

                const app = new Vue({
                    services,
                    render: h => h(component, this.getData(options)),
                    ...this.getComponentOptions(options)
                });

                app.$mount(el);
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IModelService, BrowserModelService);
    }

    private getElementId(settings: IVueBrowserModuleSettings): string {
        if (settings.el) {
            // Vue expects the element id to be prefixed with a '#'
            return settings.el[0] === "#" ? settings.el : "#" + settings.el;
        }

        return "#app";
    }

    private getComponentOptions(mountOptions?: IVueMountOptions): ComponentOptions<Vue> {
        if (mountOptions && mountOptions.options) {
            return typeof mountOptions.options === "function" 
                ? mountOptions.options()
                : mountOptions.options;
        }

        return {};
    }

    private getData(mountOptions?: IVueMountOptions): VNodeData | undefined {
        if (mountOptions && mountOptions.data) {
            return typeof mountOptions.data === "function" 
                ? mountOptions.data()
                : mountOptions.data;
        }

        return undefined;
    }
}