import Vue, { ComponentOptions, VNodeData } from "vue";
import Router from "vue-router";
import { IModule, IModuleConfigurator, IModuleInitializer, IModuleSettingsCollection, IServiceCollection, IServiceRegistration, ModuleInstanceOrConstructor, ModuleLoader } from "@shrub/core";
import { IModelService, ModelModule } from "@shrub/model";
import { IVueConfiguration, IVueMountOptions, VueModule } from "@shrub/vue";
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
    /** Optional set of models that will get injected before rendering server-side and also serialized and set as the state to pass to the client. */
    models?: { readonly [key: string]: any };
    /** Optional module settings that will be passed down to the modules when rendering server-side. */
    settings?: IModuleSettingsCollection;
    /** Opional url identifying the current request url and is needed when the main SSR component uses a vue-router. */
    url?: string;
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

/** The result when creating a Vue app for SSR rendering. */
export interface IVueSSRCreateResult {
    readonly app: Vue;
    readonly router?: Router;
}

/** 
 * Loads the specified modules (along with the VueServerModule) and returns a Vue SSR render handler. 
 * Example usage in the server entry file:
 * 
 * export default bootstrap([modules]);
 * 
 * Note: modules will be loaded/created for each request so it's important that module instances passed
 * into the bootstrap function not maintain state.
 */
export function bootstrap(modules: ModuleInstanceOrConstructor[], builder?: IVueSSRRenderHandlerBuilder): IVueSSRRenderHandler {
    modules = [...modules, VueServerModule];
    return async context => {
        // modules are loaded asynchronously so wait for them to finish loading and grab the modules collection
        const collection = await ModuleLoader.load({ modules, settings: context.settings });

        if (context.models) {
            // inject the model objects so that they are available when rendering server-side
            const service = collection.services.get(IModelService);
            for (const key in context.models) {
                service.set(key, context.models[key]);
            }
        }

        if (context.beginRender) {
            // this allows server components the ability to configure the service collection before rendering it server-side
            // the services collection captured/used by the current module is the same one passed into the component when rendered
            await context.beginRender(collection.services);
        }

        const instance = collection.getInstance(VueServerModule);
        let { app, router } = instance.createApp();

        context.rendered = () => {
            // if model state has been captured during SSR set it as the context so it can be loaded client side
            const modelService = <ServerModelService>app.$services.get(IModelService);
            if (modelService.hasModels) {
                // by setting context.state Vue will inline a global __INITIAL_STATE__ variable
                // https://ssr.vuejs.org/api/#template
                context.state = modelService.serialize();
            }
        };
        
        // if a 'builder' is provided invoke it now to allow extending the Vue app instance
        app = builder ? await builder(context, app) : app;

        if (router && context.url) {
            // if a router and request url are avaiable update the router to use the request url as its route location
            router.push(context.url);

            // wait until the router has resolved
            return new Promise<Vue>((resolve, reject) => router!.onReady(() => {
                if (!router!.getMatchedComponents().length) {
                    // no routes matched the request url so reject with a 404
                    return reject({ code: 404 });
                }

                resolve(app);
            },
            reject));
        }

        return app;
    };
}

/** Vue module for server side rendered components. */
export class VueServerModule implements IModule {
    private services?: IServiceCollection;
    private component?: typeof Vue;
    private mountOptions?: IVueMountOptions;

    readonly name = "vue-server";
    readonly dependencies = [
        ModelModule, 
        VueModule
    ];

    initialize(init: IModuleInitializer): void {
        // override the vue configuration to prevent mounting to an html element
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

    createApp(): IVueSSRCreateResult {
        if (!this.component) {
            throw new Error("Vue component has not been mounted.");
        }

        const options = this.getComponentOptions();
        const app = new Vue({
            services: this.services,
            render: h => h(this.component, this.getData()),
            ...options
        });

        return { app, router: options.router };
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