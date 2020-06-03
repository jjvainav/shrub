import { RequestHandler, Router } from "express";
import { PathParams } from "express-serve-static-core";
import { IInstantiationService } from "@shrub/core";
import { IControllerRequestService } from "./internal";

export type Constructor<T> = { new(...args: any[]): T };

/** Defines route handlers that get injected into the route handler chain for a controller function. */
export interface IRouteInterceptors {
    readonly before?: RequestHandler | RequestHandler[];
    readonly after?: RequestHandler | RequestHandler[];
}

interface IRouterMatcher {
    (path: PathParams, ...handlers: RequestHandler[]): Router;
}

interface IRouteAttribute {
    (path: PathParams, ...handlers: RequestHandler[]): (ctor: Function) => void;
    (...handlers: RequestHandler[]): (ctor: Function) => void;
}

const controllerKey = "__controller";
const routerKey = "__router";
const routesKey = "__routes";

const routeHandler: (proto: any, propertyKey: string) => RequestHandler = (proto, propertyKey) => (req, res, next) => {
    const controller = (<any>req)[controllerKey];
    if (!controller) {
        return next(new Error(`Controller '${proto.constructor.name}' not found for request '${req.path}'.`));
    }

    const handler: RequestHandler = controller[propertyKey];
    if (!handler) {
        return next(new Error(`Request handler method '${propertyKey}' not found on controller '${proto.constructor.name}'.`));
    }

    // a request handler may return a promise or not; if the request handler is async capture unhandled errors and pass them to next
    // this can easly be done by wrapping the result in a Promise.resolve() and handling catch 
    Promise.resolve(handler.call(controller, req, res, next)).catch(err => next(err));
};

/** A class decorator for a Controller identifying the request route the controller handles. */
export const Route: IRouteAttribute = function () {
    const path = arguments.length && typeof arguments[0] !== "function" ? arguments[0] : undefined;
    const handlers = path === undefined ? arguments : Array.prototype.slice.call(arguments, 1);

    return function (ctor: Function) {
        // the method/function decorators get called before the class decorator
        const sub: Router = ctor.prototype[routesKey];
        if (!sub) {
            throw new Error(`No sub-routes found for Controller '${ctor.name}.'`);
        }

        const router = Router();

        if (path) {
            router.use(path, ...handlers, createController(<Constructor<any>>ctor), sub);
        }
        else {
            router.use(...handlers, createController(<Constructor<any>>ctor), sub);
        }

        ctor.prototype[routerKey] = router;
    };
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP DELETE method.*/        
export function Delete(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void;
export function Delete(path?: PathParams, interceptors?: IRouteInterceptors): (target: any, propertyKey: string) => void; 
export function Delete(path?: PathParams, interceptors?: any): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path || "/", toRouteInterceptors(interceptors), router => router.delete);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP GET method.*/        
export function Get(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void;
export function Get(path?: PathParams, interceptors?: IRouteInterceptors): (target: any, propertyKey: string) => void; 
export function Get(path?: PathParams, interceptors?: any): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path || "/", toRouteInterceptors(interceptors), router => router.get);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP PATCH method.*/        
export function Patch(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void;
export function Patch(path?: PathParams, interceptors?: IRouteInterceptors): (target: any, propertyKey: string) => void; 
export function Patch(path?: PathParams, interceptors?: any): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path || "/", toRouteInterceptors(interceptors), router => router.patch);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP POST method.*/        
export function Post(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void;
export function Post(path?: PathParams, interceptors?: IRouteInterceptors): (target: any, propertyKey: string) => void; 
export function Post(path?: PathParams, interceptors?: any): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path || "/", toRouteInterceptors(interceptors), router => router.post);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP PUT method.*/        
export function Put(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void;
export function Put(path?: PathParams, interceptors?: IRouteInterceptors): (target: any, propertyKey: string) => void; 
export function Put(path?: PathParams, interceptors?: any): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path || "/", toRouteInterceptors(interceptors), router => router.put);
}

/** Middleware that exposes the routes for a Controller. */
export function useController<T>(ctor: Constructor<T>): RequestHandler {
    const router: Router = ctor.prototype[routerKey];
    if (!router) {
        throw new Error(`Invalid controller '${ctor.name}', class does not have a Route decorator.`);
    }

    return router;
}

/** 
 * Creates a route decorator for a controller. This is used to create the HTTP method routes and is
 * useful for creating custom route decorators.
 */
export function createRouteDecorator(path: PathParams, interceptors: IRouteInterceptors, cb: (router: Router) => IRouterMatcher): (target: any, propertyKey: string) => void {
    return (target, propertyKey) => {
        target[routesKey] = target[routesKey] || Router();

        const routes: Router = target[routesKey];
        cb(routes).call(
            routes, 
            path, 
            ...toArray(interceptors.before), 
            routeHandler(target, propertyKey),
            ...toArray(interceptors.after));
    };
}
 
/** Middleware that creates a new Controller instance for a request. */
function createController<T>(ctor: Constructor<T>): RequestHandler {
    return (req, _, next) => {
        req.context.services.get(IControllerRequestService).captureRequest(req);
        (<any>req)[controllerKey] = req.context.services.get(IInstantiationService).createInstance(ctor);
        next();
    };
}

function toArray(handlers?: RequestHandler | RequestHandler[]): RequestHandler[] {
    return !handlers 
        ? []
        : Array.isArray(handlers)
            ? handlers
            : [handlers];
}

function toRouteInterceptors(args: IArguments): IRouteInterceptors {
    if (!args || args.length < 2) {
        return {};
    }

    if (args.length === 2 && typeof args[1] === "object") {
        return args[1];
    }

    const handlers: RequestHandler[] = [];
    for (let i = 1; i < args.length; i++) {
        handlers.push(args[i]);
    }

    return { before: handlers };
}