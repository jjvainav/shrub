import { createService, IServiceCollection, Transient } from "@shrub/service-collection";
import { IControllerRequestService } from "./internal";

declare global {
    namespace Express {
        interface Request {
            readonly context: IRequestContext;
        }        
    }
}

/** 
 * Defines a context representing the current request. 
 * All express modules that want to extend a request
 * context should add properties to this interface instead
 * of extending the express Request object. This helps
 * avoid conflict with other libraries that extend express.
 * 
 * declare module "@shrub/express-core/dist/request-context" {
 *     interface IRequestContext {
 *         readonly customProperty?: any;
 *     }
 * }
 */
export interface IRequestContext {
    /** Available to express middleware for associating arbitrary state with a request. */
    readonly bag: { [key: string]: any };
    /** A reference to the service collection avaible to the request. */
    readonly services: IServiceCollection;
}

/** 
 * A service that provides access to the current request context. 
 * 
 * Caution needs to used with this service. It is intended for internal API services that need access 
 * to the current request context and any API service that depends on this service must be transient.
 */
export interface IRequestContextService {
    readonly current: IRequestContext;
}

export const IRequestContextService = createService<IRequestContextService>("request-context-service");

@Transient
export class RequestContextService implements IRequestContextService {
    readonly current: IRequestContext;

    constructor(@IControllerRequestService service: IControllerRequestService) {
        const req = service.getCurrentRequest();
        if (!req) {
            throw new Error("Current request not defined.");
        }

        this.current = req.context;
    }
}