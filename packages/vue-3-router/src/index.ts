import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3"; 
import { createRouter, createWebHistory, RouteRecordRaw, Router, RouterHistory, RouterOptions, RouterScrollBehavior, createMemoryHistory } from "vue-router";

/** Defines configuration for the Vue router module. */
export interface IVueRouterConfiguration {
    /** Adds the specified route to the router. */
    addRoute(route: RouteRecordRaw): void;
    /** Forces the creation of the Vue Router. Normally, it will automatically get created after all modules have been loaded but this will allow manual creation for when it is needed sooner. */
    createRouter(): void;
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
        config(IVueRouterConfiguration).register(({ config }) => ({
            addRoute: route => {
                if (this.options) {
                    this.options.routes!.push(route);
                }
                else if (this.router) {
                    this.router.addRoute(route);
                }
            },
            createRouter: () => this.createRouter(config.get(IVueConfiguration)),
            useHistory: history => {
                if (this.router) {
                    throw new Error("Vue router has already been created.");
                }

                if (this.options) {
                    this.options.history = history;
                }
            },
            useScrollBehavior: scrollBehavior => {
                if (this.router) {
                    throw new Error("Vue router has already been created.");
                }

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
        vue.configure(app => app.use(this.createRouter(vue)));
    }

    private createRouter(vue: IVueConfiguration): Router {
        if (this.options) {
            this.router = createRouter({
                history: this.options.history || vue.isServer ? createMemoryHistory() : createWebHistory(),
                routes: this.options.routes!
            });

            this.options = undefined;
        }

        return this.router!;
    }
}