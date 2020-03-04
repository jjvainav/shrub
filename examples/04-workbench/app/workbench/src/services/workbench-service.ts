import { createService, Singleton } from "@shrub/core";
import { IComponent } from "@shrub/vue";
import { IEsModuleLocalMessages, ILocaleMessages, IVueI18nService } from "@shrub/vue-i18n";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { VueConstructor } from "vue";
import Router, { RawLocation, Route, RouteConfig } from "vue-router";
import { ModuleExampleComponent } from "../components";
import * as utils from "../utils";

export const IWorkbenchService = createService<IWorkbenchService>("workbench-service");

export interface IWorkbenchService {
    readonly onRouteChanged: IEvent;
    readonly currentExample?: IWorkbenchExample;
    readonly currentRoute: IWorkbenchRoute;
    readonly router: Router;
    getExample(name: string): IWorkbenchExample | undefined;
    getExamples(): Iterable<IWorkbenchExample>;
    navigateTo(link: IWorkbenchLink): void;
    registerExample(example: IWorkbenchExample): void;
    registerRoute(route: IWorkbenchRouteConfig): void;
}

export interface IWorkbenchLink {
    /** The name of the route. */
    readonly name?: string;
    /** A route path. */
    readonly path?: string;
    /** Represents url params e.g user/123 - not used when path is set. */
    readonly params?: { [key: string]: string };
    /** Represents url query string arguments. */
    readonly query?: { [key: string]: string | string[] };
}

export interface IWorkbenchRoute {
    readonly name?: string;
    readonly path: string;
    readonly params: { [key: string]: string };
    readonly query: { [key: string]: string | (string | null)[] };
    isMatch(link: IWorkbenchLink): boolean;
}

export interface IWorkbenchRouteConfig {
    readonly name?: string;
    readonly path?: string;
    readonly component?: IComponent | (() => Promise<IComponent | IEsModuleComponent>);
    readonly redirect?: string;
    readonly props?: (route: IWorkbenchRoute) => Object;
}

export interface IWorkbenchExample {
    readonly name: string;
    readonly title: string;
    readonly component: () => Promise<IComponent | IEsModuleComponent>;
    readonly locale: (locale: string) => Promise<ILocaleMessages | IEsModuleLocalMessages>;
    readonly menu: IWorkbenchMenuItem;
    readonly props?: (route: IWorkbenchRoute) => Object;
}

export interface IWorkbenchMenuItem {
    readonly title: string;
    readonly order?: number;
}

/** Needed for dynamic import support. */
export interface IEsModuleComponent {
    readonly default: IComponent
}

@Singleton
export class WorkbenchBrowserService implements IWorkbenchService {
    private readonly routeChanged = new EventEmitter("route-changed");
    private readonly examples = new Map<string, IWorkbenchExample>();
    private key = 1;

    readonly router = new Router({
        mode: "history",
        scrollBehavior: (to, from, savedPosition) => savedPosition || { x: 0, y: 0 }
    });

    constructor(@IVueI18nService private readonly i18nService: IVueI18nService) {
        this.router.beforeEach((to, from, next) => {
            // TODO: determine current language/locale
            console.log("fullPath", to.fullPath);
            console.log("path", to.path);

            i18nService.setLocale("en-US", to.path).then(() => next());
        });

        this.router.afterEach(() => this.routeChanged.emit());
    }

    get onRouteChanged(): IEvent {
        return this.routeChanged.event;
    }

    get currentExample(): IWorkbenchExample | undefined {
        if (this.router.currentRoute.name) {
            return this.examples.get(this.router.currentRoute.name);
        }

        return undefined;
    }

    get currentRoute(): IWorkbenchRoute {
        return this.asWorkbenchRoute(this.router.currentRoute);
    }

    getExample(name: string): IWorkbenchExample | undefined {
        return this.examples.get(name);
    }

    getExamples(): Iterable<IWorkbenchExample> {
        return this.examples.values();
    }

    navigateTo(link: IWorkbenchLink): void {
        this.router.push(this.asRawLocation(link));
    }

    registerExample(example: IWorkbenchExample): void {
        example = {
            ...example,
            name: utils.toKebabCase(example.name)
        };

        if (this.examples.has(example.name)) {
            throw new Error(`Duplicate example (${example.name})`);
        }

        const path = "/" + example.name;
        this.registerRoute({
            path,
            name: example.name,
            component: example.component,
            props: example.props
        });

        this.i18nService.registerLoader(options => {
            if (options.path === path) {
                return example.locale(options.locale);
            }

            return Promise.resolve({});
        });

        this.examples.set(example.name, example);
    }

    registerRoute(route: IWorkbenchRouteConfig): void {
        this.router.addRoutes([this.getRouteConfig(route)]);
    }

    private getRouteConfig(route: IWorkbenchRouteConfig): RouteConfig {
        // if the route defines a component use that; otherwise, check if the route is not 
        // a redirect and use the module example component if it is not
        const component = route.component
            ? this.asVueComponent(route.component)
            : !route.redirect ? ModuleExampleComponent : undefined;

        const props = route.props !== undefined 
            ? ((r: Route) => route.props!(this.asWorkbenchRoute(r)))
            : undefined;

        return {
            name: route.name,
            path: route.path || "",
            redirect: route.redirect,
            meta: { key: this.key++ },
            component,
            props
        };
    }

    private asRawLocation(link: IWorkbenchLink): RawLocation {
        return {
            name: link.name,
            path: link.path,
            params: link.params,
            query: link.query
        };
    }

    private asVueComponent(component: IComponent | IEsModuleComponent | (() => Promise<IComponent | IEsModuleComponent>)): any {
        if (typeof component === "function") {
            return () => component().then(c => <VueConstructor>this.asVueComponent(c));
        }

        if (this.isEsModuleWorkbenchComponent(component)) {
            return this.asVueComponent(component.default);
        }
        
        return component.ctor;
    }

    private asWorkbenchRoute(route: Route): IWorkbenchRoute {
        return {
            name: route.name,
            path: route.path,
            params: route.params,
            query: route.query,
            isMatch: link => { 
                const value = this.router.resolve(this.asRawLocation(link));
                return value.route.meta.key === route.meta.key;
            }
        };
    }

    private isEsModuleWorkbenchComponent(component: IComponent | IEsModuleComponent): component is IEsModuleComponent {
        return (<IEsModuleComponent>component).default !== undefined;
    }
}