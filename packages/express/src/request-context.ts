import { createService, IServiceCollection, Scoped } from "@shrub/core";
import { RequestHandler } from "express";
 
declare global {
    namespace Express {
        interface Request {
            /** Gets the current request context. */
            readonly context: IRequestContext;
            /** Gets the scoped service collection for the request. */
            readonly services: IServiceCollection;
        }        
    }
}

/** 
 * Defines a context representing the current request. 
 * It's recommended that express modules extend the request
 * context instead of the express Request object. This helps
 * avoid conflict with other libraries that extend express and
 * also allows services outside of express middleware the ability
 * to access the request context via the request context service.
 * 
 * declare module "@shrub/express/dist/request-context" {
 *     interface IRequestContext {
 *         customProperty?: any;
 *     }
 * }
 */
export interface IRequestContext {
    /** Available to express middleware for associating arbitrary state with a request. */
    readonly bag: { [key: string]: any };
    /** A reference to the service collection available to the request. */
    readonly services: IServiceCollection;
}

export interface IRequestContextService {
    readonly context: IRequestContext;
}

export const IRequestContextService = createService<IRequestContextService>("request-context-service");

/** @internal Express middleware that creates and installs the request context; the provided service collection should be the root collection in which a scoped collection will be created from. */
export const requestContext: (services: IServiceCollection) => RequestHandler = services => (req, res, next) => {
    // use a scoped service collection for the request
    const requestServices = services.createScope();
    const requestContextService = requestServices.get(IRequestContextService);

    res.on("finish", () => requestServices.dispose());

    // note: this needs to be configurable to support express sub apps
    // when loading a set of modules as an independent sub app the root app will
    // have defined a context on the request but for sub apps we need to overwrite
    // it using the context configured for this specific domain
    Object.defineProperty(req, "context", {
        configurable: true,
        get() { return requestContextService.context; }
    });

    Object.defineProperty(req, "services", {
        configurable: true,
        get() { return requestServices; }
    });

    next();
};

/** @internal */
@Scoped
export class RequestContextService implements IRequestContextService {
    readonly context: IRequestContext;

    constructor(@IServiceCollection services: IServiceCollection) {
        this.context = { bag: {}, services };
    }
}