import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3"; 
import { createRouter, createWebHistory, RouteRecordRaw, Router, RouterHistory, RouterOptions, RouterScrollBehavior, createMemoryHistory } from "vue-router";

/** Defines configuration for the Vue router module. */
export interface IVueRouterConfiguration {
    /** Adds the specified route to the router. */
    addRoute(route: RouteRecordRaw): void;
    /** Configures the router to use the specified history; by default, the router will use the web history or memory history when running on the server. */
    useHistory(history: RouterHistory): void;
    /** Configures the router to use the specified scroll behavior. */
    useScrollBehavior(scrollBehavior: RouterScrollBehavior): void;
}

export interface IVueRouterService {
    /** The router for the current application. */
    readonly router: Router;
}

export const IVueRouterService = createService<IVueRouterService>("vue-router-service");
export const IVueRouterConfiguration = createConfig<IVueRouterConfiguration>();

export class VueRouterModule implements IModule {
    private router?: Router;
    private options?: Partial<RouterOptions> = {
        routes: []
    };

    readonly dependencies = [VueModule];
    readonly name = "vue-router";

    initialize({ config }: IModuleInitializer): void {
        config(IVueRouterConfiguration).register(() => ({
            addRoute: route => {
                if (this.options) {
                    this.options.routes!.push(route);
                }
            },
            useHistory: history => {
                if (this.options) {
                    this.options.history = history;
                }
            },
            useScrollBehavior: scrollBehavior => {
                if (this.options) {
                    this.options.scrollBehavior = scrollBehavior;
                }
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        const self = this;
        registration.registerInstance(IVueRouterService, { 
            get router() {
                return self.router!;
            }
        });
    }

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();

        const vue = config.get(IVueConfiguration);
        vue.configure(app => {
            if (this.options) {
                this.router = createRouter({
                    history: this.options.history || vue.isServer ? createMemoryHistory() : createWebHistory(),
                    routes: this.options.routes!
                });

                this.options = undefined;
                app.use(this.router);
            }
        });
    }
}