import Vue, { VueConstructor } from "vue";
import Router, { RawLocation, Route, RouteConfig } from "vue-router";
import { EventEmitter, IEvent } from "@shrub/event-emitter";
import { createService, Singleton } from "@shrub/service-collection";
import { IComponent } from "@shrub/vue-core";
import { ModuleExampleComponent } from "../components";

Vue.use(Router);

export const IWorkbenchService = createService<IWorkbenchService>("workbench-service");

export interface IWorkbenchService {
    readonly onRouteChanged: IEvent;
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
    readonly path: string;
    readonly component?: IComponent | (() => Promise<IComponent | IEsModuleComponent>);
    readonly children?: IWorkbenchRouteConfig[];
    readonly redirect?: string;
    readonly props?: (route: IWorkbenchRoute) => Object;
}

export interface IWorkbenchExample {
    readonly name: string;
    readonly routes: IWorkbenchRouteConfig[];
    readonly menu?: IWorkbenchMenuItem[];
}

export interface IWorkbenchMenuItem {
    readonly title: string;
    readonly link: IWorkbenchLink;
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

    constructor() {
        this.router.afterEach(() => this.routeChanged.emit());
    }

    get onRouteChanged(): IEvent {
        return this.routeChanged.event;
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
        if (this.examples.has(example.name)) {
            throw new Error(`Duplicate example (${example.name})`);
        }

        this.registerRoute({
            path: "/" + example.name.toKebabCase(),
            children: example.routes
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
            path: route.path,
            redirect: route.redirect,
            meta: { key: this.key++ },
            children: route.children && route.children.map(child => this.getRouteConfig(child)),
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