import { createService, Singleton } from "@shrub/core";
import { IEsModuleLocalMessages, ILocaleMessageObject, IVueI18nService } from "@shrub/vue-3-i18n";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { Component } from "vue";
import VueRouter, { RouteLocationNormalized, RouteLocationRaw, RouteRecordRaw } from "vue-router";
import { ModuleExampleComponent } from "../components";
import * as utils from "../utils";

export const IWorkbenchService = createService<IWorkbenchService>("workbench-service");

export interface IWorkbenchService {
    readonly onRouteChanged: IEvent;
    readonly currentExample?: IWorkbenchExample;
    readonly currentLocale: string;
    readonly currentRoute: IWorkbenchRoute;
    readonly router: VueRouter.Router;
    getExample(name: string): IWorkbenchExample | undefined;
    getExamples(): IWorkbenchExample[];
    getLocaleString(callback: ILocaleCallback): string;
    navigateTo(link: IWorkbenchLink): void;
    registerExample(example: IWorkbenchExample): void;
    registerRoute(route: IWorkbenchRouteConfig): void;
    setLocale(locale: string): Promise<void>;
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
    readonly params: { [key: string]: string | string[] };
    readonly query: { [key: string]: null | string | (string | null)[] };
    isMatch(link: IWorkbenchLink): boolean;
}

export interface IWorkbenchRouteConfig {
    readonly name?: string;
    readonly path?: string;
    readonly component?: IComponent | (() => Promise<IComponent | IEsModuleComponent>);
    readonly redirect?: string;
    readonly props?: (route: IWorkbenchRoute) => Record<string, any>;
}

export interface IWorkbenchExample {
    readonly name: string;
    readonly title: string | ILocaleCallback;
    readonly content: IWorkbenchContent;
    readonly menu: IWorkbenchMenuItem;
    readonly locale: (locale: string) => Promise<ILocaleMessageObject | IEsModuleLocalMessages>;
    readonly props?: (route: IWorkbenchRoute) => Object;
}

export interface IWorkbenchContent {
    readonly component: () => Promise<IComponent | IEsModuleComponent>;
    readonly locale?: (locale: string) => Promise<ILocaleMessageObject | IEsModuleLocalMessages>;
}

export interface IWorkbenchMenuItem {
    readonly icon: string;
    readonly title: string | ILocaleCallback;
    readonly order?: number;
}

export interface ILocaleContext {
    translate(key: string, named?: Record<string, unknown>): string;
}

export interface ILocaleCallback {
    (context: ILocaleContext): string;
}

/** Exposes a reference to a Vue component. */
export interface IComponent {
    readonly comp: Component;
}

/** Needed for dynamic import support. */
export interface IEsModuleComponent {
    readonly default: IComponent;
}

@Singleton
export class WorkbenchBrowserService implements IWorkbenchService {
    private readonly routeChanged = new EventEmitter("route-changed");
    private readonly examples = new Map<string, IWorkbenchExample>();
    private key = 1;

    readonly router = VueRouter.createRouter({
        history: VueRouter.createWebHistory(),
        routes: [],
        scrollBehavior: (to, from, savedPosition) => savedPosition || { top: 0 }
    });

    constructor(@IVueI18nService private readonly i18nService: IVueI18nService) {
        this.router.beforeEach((to, from, next) => {
            i18nService.setLocale(i18nService.currentLocale, to.path).then(() => next());
        });

        this.router.afterEach(() => this.routeChanged.emit());
    }

    get onRouteChanged(): IEvent {
        return this.routeChanged.event;
    }

    get currentExample(): IWorkbenchExample | undefined {
        if (this.router.currentRoute.value.name) {
            return this.examples.get(<string>this.router.currentRoute.value.name);
        }

        return undefined;
    }

    get currentLocale(): string {
        return this.i18nService.currentLocale;
    }

    get currentRoute(): IWorkbenchRoute {
        return this.asWorkbenchRoute(this.router.currentRoute.value);
    }

    getExample(name: string): IWorkbenchExample | undefined {
        return this.examples.get(name);
    }

    getExamples(): IWorkbenchExample[] {
        return Array.from(this.examples.values());
    }

    getLocaleString(callback: ILocaleCallback): string {
        return callback({ translate: (key, named) => this.i18nService.translate(key, named) });
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
            component: example.content.component,
            props: example.props
        });

        this.i18nService.registerLoader(options => example.locale(options.locale));

        if (example.content.locale) {
            this.i18nService.registerLoader(options => {
                if (options.path === path) {
                    return example.content.locale!(options.locale);
                }

                return Promise.resolve({});
            });
        }

        this.examples.set(example.name, example);
    }

    registerRoute(route: IWorkbenchRouteConfig): void {
        this.router.addRoute(this.getRouteConfig(route));
    }

    setLocale(locale: string): Promise<void> {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale;
        }

        return this.i18nService.setLocale(locale, this.router.currentRoute.value.path);
    }

    private getRouteConfig(route: IWorkbenchRouteConfig): RouteRecordRaw {
        // if the route defines a component use that; otherwise, check if the route is not 
        // a redirect and use the module example component if it is not
        const component = route.component
            ? this.asVueComponent(route.component)
            : !route.redirect ? ModuleExampleComponent : undefined;

        const props = route.props !== undefined 
            ? ((to: RouteLocationNormalized) => route.props!(this.asWorkbenchRoute(to)))
            : undefined;

        return <RouteRecordRaw>{
            name: route.name,
            path: route.path || "",
            redirect: route.redirect,
            meta: { key: this.key++ },
            component,
            props
        };
    }

    private asRawLocation(link: IWorkbenchLink): RouteLocationRaw {
        return {
            name: link.name,
            path: link.path,
            params: link.params,
            query: link.query
        };
    }

    private asVueComponent(component: IComponent | IEsModuleComponent | (() => Promise<IComponent | IEsModuleComponent>)): Component | Promise<Component> {
        if (typeof component === "function") {
            return component().then(c => this.asVueComponent(c));
        }

        if (this.isEsModuleWorkbenchComponent(component)) {
            return this.asVueComponent(component.default);
        }
        
        return component.comp;
    }

    private asWorkbenchRoute(route: RouteLocationNormalized): IWorkbenchRoute {
        return {
            name: route.name !== null ? <string>route.name : undefined,
            path: route.path,
            params: route.params,
            query: route.query,
            isMatch: link => { 
                const value = this.router.resolve(this.asRawLocation(link));
                return value.meta.key === route.meta.key;
            }
        };
    }

    private isEsModuleWorkbenchComponent(component: IComponent | IEsModuleComponent): component is IEsModuleComponent {
        return (<IEsModuleComponent>component).default !== undefined;
    }
}