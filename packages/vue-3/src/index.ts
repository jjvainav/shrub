import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IService, IServiceCollection, IServiceRegistration } from "@shrub/core";
import { App, ComponentPublicInstance, ComponentOptions, createApp, h, inject, VNode, VNodeProps } from "vue";

declare module "@vue/runtime-core" {
    interface ComponentCustomProperties {
        /** Provides access to the global services container. */
        readonly $services: IServiceCollection;
    }
}

export type ComponentProps<P> = VNodeProps & Record<string, any> & P;

export interface IVueAppService {
    readonly app: App;
    readonly instance: ComponentPublicInstance;
}

export interface IVueConfiguration {
    /** Allows configuring the Vue application before the root component is mounted. */
    configure(callback: (app: App<Element>) => void): void;
    /** Mounts a root Vue component. */
    mount<P>(component: ComponentOptions<P> | (() => ComponentOptions<P>), props?: ComponentProps<P> | (() => ComponentProps<P>)): void;
}

export interface IVueModuleSettings {
    /** The element id to mount to; the default is #app. */
    readonly el?: string;
}

// a basic interface for interacting with Vue router which avoids the need to import the vue-router package
interface IVueRouter {
    isReady(): Promise<void>;
}

export const IVueAppService = createService<IVueAppService>("vue-app-service");
export const IVueConfiguration = createConfig<IVueConfiguration>();

const servicesKey = Symbol("services");

/** Provides access to the service collection for the current Vue app and is intended to be used with the new composition Api. */
export function useServices(): IServiceCollection {
    return inject(servicesKey)!;
}

/** Gets an instances of the specified service registered with the current Vue app. */
export function useService<T>(service: IService<T>): T {
    const services = <IServiceCollection>inject(servicesKey)!;
    return services.get(service);
}

export class VueModule implements IModule {
    private readonly app = createApp({
        render: () => this.render!()
    });

    private component?: ComponentOptions<any> | (() => ComponentOptions<any>);
    private instance?: ComponentPublicInstance;
    private props?: ComponentProps<any> | (() => ComponentProps<any>);
    private render?: () => VNode;

    readonly name = "vue";

    initialize({ config }: IModuleInitializer): void {
        config(IVueConfiguration).register(() => ({
            configure: callback => callback(this.app),
            mount: (component, props) => {
                if (this.component) {
                    throw new Error("A component has already been mounted.");
                }

                this.component = component;
                this.props = props;
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        const self = this;
        registration.registerInstance(IVueAppService, { 
            app: this.app,
            get instance() {
                return self.instance!;
            } 
        });
    }

    async configure({ settings, services, next }: IModuleConfigurator): Promise<void> {
        this.app.config.globalProperties.$services = services;
        this.app.provide(servicesKey, services);

        // mount the element after all dependents have had a chance to configure
        await next();

        if (!this.component) {
            // TODO: write a warning to the console
            return Promise.resolve();
        }

        const el = this.getElementId(settings);
        if (!document.getElementById(el.substr(1))) {
            throw new Error(`Element with id (${el}) not found`);
        }

        const router = <IVueRouter>this.app.config.globalProperties.$router;
        const component = typeof this.component === "function" ? this.component() : this.component;
        const props = typeof this.props === "function" ? this.props() : this.props;
        this.render = () => h(component, props);

        if (router) {
            // need to wait on the router when using SSR
            router.isReady().then(() => this.instance = this.app.mount(el));
        }
        else {
            this.instance = this.app.mount(el);
        }
    }

    private getElementId(settings: IVueModuleSettings): string {
        if (settings.el) {
            // Vue expects the element id to be prefixed with a '#'
            return settings.el[0] === "#" ? settings.el : "#" + settings.el;
        }

        return "#app";
    }
}