import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IService, IServiceCollection, IServiceRegistration } from "@shrub/core";
import { App, Component, ComponentPublicInstance, DefineComponent, createApp, createSSRApp, h, inject, VNode } from "vue";

declare module "@vue/runtime-core" {
    interface ComponentCustomProperties {
        /** Provides access to the global services container. */
        readonly $services: IServiceCollection;
    }
}

export type RootProps = Record<string, unknown>;

export interface IVueAppService {
    /** The Vue app for the current application. */
    readonly app: App;
    /** The component instance for the root component; note, this will be undefined during SSR. */
    readonly instance?: ComponentPublicInstance;
}

/** Defines configuration for the Vue module. */
export interface IVueConfiguration {
    /** True if the current Vue application is configured for ssr server-side rendering. */
    readonly isServer: boolean;
    /** Allows configuring the Vue application before the root component is mounted. */
    configure(callback: (app: App<Element>) => void): void;
    /** Mounts a root Vue component. */
    mount(component: DefineComponent<{}, {}, any>, props?: RootProps | ((services: IServiceCollection) => RootProps)): void;
}

export interface IVueModuleSettings {
    /** The element id to mount to; the default is #app. */
    readonly el?: string;
    /** 
     * True if the Vue App should be created for server-side rendering; the default is false. 
     * When using SSR this should be true for both client and server.
     */
    readonly ssr?: boolean;
    /** True if the current instance is running on the server. This is only used when ssr is true; note, the App instance is accessible via the IVueAppService. */
    readonly isServer?: boolean;
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
    private readonly root: Component = { render: () => this.render!() };

    private app?: App<Element>;
    private component?: DefineComponent<{}, {}, any>;
    private instance?: ComponentPublicInstance;
    private props?: RootProps | ((services: IServiceCollection) => RootProps);
    private render?: () => VNode;

    readonly name = "vue";

    initialize({ config }: IModuleInitializer): void {
        config(IVueConfiguration).register(({ settings }) => ({
            isServer: !!(<IVueModuleSettings>settings).isServer,
            configure: callback => callback(this.app!),
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
            get app() {
                return self.app!;
            },
            get instance() {
                return self.instance!;
            } 
        });
    }

    async configure({ settings, services, next }: IModuleConfigurator): Promise<void> {
        this.app = (<IVueModuleSettings>settings).ssr ? createSSRApp(this.root) : createApp(this.root);
        this.app.config.globalProperties.$services = services;
        this.app.provide(servicesKey, services);

        // mount the element after all dependents have had a chance to configure
        await next();

        if (!this.component) {
            // TODO: write a warning to the console
            return Promise.resolve();
        }

        const component = this.component;
        const props = typeof this.props === "function" ? this.props(services) : this.props;
        this.render = () => h(component, props);

        if (!(<IVueModuleSettings>settings).isServer) {
            const el = this.getElementId(settings);
            if (!document.getElementById(el.substr(1))) {
                throw new Error(`Element with id (${el}) not found`);
            }

            if ((<IVueModuleSettings>settings).ssr) {
                // when using ssr need to wait for the router to finish initializing before mounting:
                // https://v3.vuejs.org/guide/ssr/routing.html
                const router = <IVueRouter>this.app.config.globalProperties.$router;
                const isReady = router && router.isReady() || Promise.resolve();
                await isReady.then(() => this.instance = this.app!.mount(el));
            }
            else {
                this.instance = this.app.mount(el);
            }
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