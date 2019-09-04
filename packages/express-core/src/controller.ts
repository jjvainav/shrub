import { RequestHandler, Router } from "express";
import { PathParams } from "express-serve-static-core";
import { IInstantiationService } from "@shrub/service-collection";
import { IControllerRequestService } from "./internal";

export type Constructor<T> = { new(...args: any[]): T };

interface IRouterMatcher {
    (path: PathParams, ...handlers: RequestHandler[]): Router;
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

    handler.call(controller, req, res, next);
};

/** A class decorator for a Controller identifying the request route the controller handles. */
export function Route(path: PathParams, ...handlers: RequestHandler[]) {
    return function (ctor: Function) {
        // the method/function decorators get called before the class decorator
        const sub: Router = ctor.prototype[routesKey];
        if (!sub) {
            throw new Error(`No sub-routes found for Controller '${ctor.name}.'`);
        }
        
        const router = Router();
        router.use(path, ...handlers, createController(<Constructor<any>>ctor), sub);
        
        ctor.prototype[routerKey] = router;
    }
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP DELETE method.*/        
export function Delete(path: PathParams, ...handlers: RequestHandler[]) {
    return addRoutes(path, handlers, router => router.delete);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP GET method.*/        
export function Get(path: PathParams, ...handlers: RequestHandler[]) {
    return addRoutes(path, handlers, router => router.get);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP POST method.*/        
export function Post(path: PathParams, ...handlers: RequestHandler[]) {
    return addRoutes(path, handlers, router => router.post);
}

/** A function decorator identifying a request handler on a controller for a specific path and HTTP PUT method.*/        
export function Put(path: PathParams, ...handlers: RequestHandler[]) {
    return addRoutes(path, handlers, router => router.put);
}

/** Middleware that exposes the routes for a Controller. */
export function useController<T>(ctor: Constructor<T>): RequestHandler {
    const router: Router = ctor.prototype[routerKey];
    if (!router) {
        throw new Error(`Invalid controller '${ctor.name}', class does not have a Route decorator.`);
    }

    return router;
}
 
/** Middleware that creates a new Controller instance for a request. */
function createController<T>(ctor: Constructor<T>): RequestHandler {
    return (req, res, next) => {
        req.context.services.get(IControllerRequestService).captureRequest(req);
        (<any>req)[controllerKey] = req.context.services.get(IInstantiationService).createInstance(ctor);
        next();
    };
}

function addRoutes(path: PathParams, handlers: RequestHandler[], cb: (router: Router) => IRouterMatcher): (target: any, propertyKey: string) => void {
    return (target, propertyKey) => {
        target[routesKey] = target[routesKey] || Router();

        const routes: Router = target[routesKey];
        cb(routes).call(routes, path, ...handlers, routeHandler(target, propertyKey));
    };
}