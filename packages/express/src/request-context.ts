import { createService, IServiceCollection, Scoped } from "@shrub/core";

declare global {
    namespace Express {
        interface Request {
            /** Gets the current request context. */
            readonly context: IRequestContext;
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

/** @internal */
@Scoped
export class RequestContextService implements IRequestContextService {
    readonly context: IRequestContext;

    constructor(@IServiceCollection services: IServiceCollection) {
        this.context = { bag: {}, services };
    }
}