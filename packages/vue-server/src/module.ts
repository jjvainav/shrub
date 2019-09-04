﻿import Vue, { ComponentOptions, VNodeData } from "vue";
import { IModule, IModuleConfigurator, IModuleInitializer, loadModules } from "@shrub/module";
import { IServiceCollection, IServiceRegistration } from "@shrub/service-collection";
import { IModelService, IVueConfiguration, IVueMountOptions, VueCoreModule } from "@shrub/vue-core";
import { ServerModelService } from "./model-service";

/** 
 * Defines a user context that gets passed into the SSR render function.
 * Vue checks for and uses a few properties internally and the rest are
 * user defined and used by the render function itself.
 */
export interface IVueSSRContext {
    /** An optional callback that the vue-server module will invoke just before the Vue app/component is rendered. */
    beginRender?: (services: IServiceCollection) => Promise<void>;
    /** An optional callback that Vue will invoke when the app as finished rendering. */
    rendered?: (context: IVueSSRContext) => void;
    /** Optional state that will get injected and passed to the client. */
    state?: any;
    [key: string]: any;
}

/** The render function expected to be exported for Vue SSR rendering. */
export interface IVueSSRRenderHandler {
    (context: IVueSSRContext): Promise<Vue>;
}

/** The callback for extending the Vue SSR render handling function. */
export interface IVueSSRRenderHandlerBuilder {
    (context: IVueSSRContext, app: Vue): Promise<Vue>;
}

/** 
 * Loads the specified modules (along with the VueServerModule) and returns a Vue SSR render handler. 
 * Example usage in the server entry file:
 * 
 * export default bootstrap([modules]);
 */
export function bootstrap(modules: IModule[], builder?: IVueSSRRenderHandlerBuilder): IVueSSRRenderHandler {
    if (!modules.find(m => m.name === "vue-server")) {
        modules = [...modules, VueServerModule];
    }

    // start loading the modules now and await for them to finish inside the SSR render handler
    const loading = loadModules(modules);
    return async context => {
        // modules are loaded asynchronously so wait for them to finish loading and grab an instance of the host
        const host = await loading;

        if (context.beginRender) {
            // this allows server components the ability to configure the service collection before rendering it server-side
            // the services collection captured/used by the current module is the same one passed into the component when rendered
            await context.beginRender(host.services);
        }

        const instance = host.getInstance(VueServerModule);
        return instance.createApp().then(async app => {
            context.rendered = () => {
                // if model state has been captured during SSR set it as the context so it can be loaded client side
                const modelService = <ServerModelService>app.$services.get(IModelService);
                if (modelService.hasModels) {
                    context.state = modelService.serialize();
                }
            };
            
            return builder ? await builder(context, app) : app;
        });
    };
}

/** Vue module for server side rendered components. */
export class VueServerModule implements IModule {
    private services?: IServiceCollection;
    private component?: typeof Vue;
    private mountOptions?: IVueMountOptions;

    readonly name = "vue-server";
    readonly dependencies = [VueCoreModule];

    initialize(init: IModuleInitializer): void {
        init.config(IVueConfiguration).register(({ services }: IModuleConfigurator) => ({
            mount: (component, options) => {
                if (this.component) {
                    throw new Error("A Vue component has already been mounted.");
                }

                this.services = services;
                this.component = component;
                this.mountOptions = options;
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IModelService, ServerModelService);
    }

    createApp(): Promise<Vue> {
        return new Promise((resolve, reject) => {
            if (!this.component) {
                reject(new Error("Vue component has not been mounted."));
            }
            else {
                resolve(new Vue({
                    services: this.services,
                    render: h => h(this.component, this.getData()),
                    ...this.getComponentOptions()
                }));
            }
        });
    }

    private getComponentOptions(): ComponentOptions<Vue> {
        if (this.mountOptions && this.mountOptions.options) {
            return typeof this.mountOptions.options === "function" 
                ? this.mountOptions.options()
                : this.mountOptions.options;
        }

        return {};
    }

    private getData(): VNodeData | undefined {
        if (this.mountOptions && this.mountOptions.data) {
            return typeof this.mountOptions.data === "function" 
                ? this.mountOptions.data()
                : this.mountOptions.data;
        }

        return undefined;
    }
}