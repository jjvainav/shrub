import { IInstantiationService } from "@shrub/core";
import { RequestHandler, Router } from "express";
import { PathParams } from "express-serve-static-core";

export type Constructor<T> = { new(...args: any[]): T };

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
export function Delete(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(registerRoute(path || "/", handlers, router => router.delete));
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP GET method.*/        
export function Get(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(registerRoute(path || "/", handlers, router => router.get));
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP PATCH method.*/        
export function Patch(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(registerRoute(path || "/", handlers, router => router.patch));
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP POST method.*/        
export function Post(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(registerRoute(path || "/", handlers, router => router.post));
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP PUT method.*/
export function Put(path?: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(registerRoute(path || "/", handlers, router => router.put));
}

/** Middleware that exposes the routes for a Controller. */
export function controller<T>(ctor: Constructor<T>): RequestHandler {
    const router: Router = ctor.prototype[routerKey];
    if (!router) {
        throw new Error(`Invalid controller '${ctor.name}', class does not have a Route decorator.`);
    }

    return router;
}

/** 
 * Creates a route decorator for a controller function; the provided callback is responsible for
 * registering a route with the provided router and the given handler is the controller handler
 * that should be included in the call chain.
 */
export function createRouteDecorator(register: (router: Router, handler: RequestHandler) => void): (target: any, propertyKey: string) => void {
    return (target, propertyKey) => {
        target[routesKey] = target[routesKey] || Router();
        register(target[routesKey], getControllerActionRouteHandler(target, propertyKey));
    };
}

function getControllerActionRouteHandler(proto: any, propertyKey: string): RequestHandler { 
    return (req, res, next) => {
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
}

function registerRoute(path: PathParams, handlers: RequestHandler[], cb: (router: Router) => IRouterMatcher): (router: Router, handler: RequestHandler) => void {
    return (router, handler) => cb(router).call(router, path, ...[...handlers, handler]);
}
 
/** Middleware that creates a new Controller instance for a request. */
function createController<T>(ctor: Constructor<T>): RequestHandler {
    return (req, _, next) => {
        (<any>req)[controllerKey] = req.context.services.get(IInstantiationService).createInstance(ctor);
        next();
    };
}