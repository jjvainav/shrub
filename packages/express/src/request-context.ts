import { createService, IServiceCollection, Scoped, Singleton } from "@shrub/core";

declare global {
    namespace Express {
        interface Request {
            /** Gets the current request context. */
            readonly context: IRequestContext;
            /** Gets the builder for the current request context. This is intended for use by upstream middleware to extend the request context and should not be used directly. */
            readonly contextBuilder: IRequestContextBuilder;
        }        
    }
}

type Mutable<T> = { -readonly[P in keyof T]: T[P] };

/** 
 * Defines a context representing the current request. 
 * All express modules that want to extend a request
 * context should register a request context builder instead
 * of trying to extend the express Request object. This helps
 * avoid conflict with other libraries that extend express.
 * 
 * declare module "@shrub/express/dist/request-context" {
 *     interface IRequestContext {
 *         readonly customProperty?: any;
 *     }
 * }
 */
export interface IRequestContext {
    /** Available to express middleware for associating arbitrary state with a request. */
    readonly bag: { [key: string]: any };
    /** A reference to the service collection available to the request. */
    readonly services: IServiceCollection;
}

/**
 * Defines a builder used to create/build request contexts.
 * This is mainly useful when there is a need to build a 
 * request context outside of the express request pipeline.
 * The express request pipeline uses the builder to construct
 * the request context.
 * 
 * Modules that extend the request context should also consider
 * extending the request context builder. Note, it may not always
 * be possible for a request context to exist outside the express
 * request pipeline.
 * 
 * declare module "@shrub/express/dist/request-context" {
 *     interface IRequestContextBuilder {
 *         addCustomProperty(...args): IRequestBuilder;
 *     }
 * }
 * 
 * Modules then should register the builder callback/function with the 
 * express module. See IRequestContextBuilderCallback for more details.
 */
export interface IRequestContextBuilder {
}

/** 
 * Defines a request context builder callback that is registered with the express module. 
 * The first parameter is expected to be a request context and the rest of the parameters 
 * are expected to match the parameters for the function declared in the IRequestContextBuilder
 * interface.. 
 */
export interface IRequestContextBuilderCallback {
    (context: IRequestContext, ...args: any[]): IRequestContext;
}

/** @internal */
export interface IRequestContextBuilderMap {
    readonly [name: string]: IRequestContextBuilderCallback;
}

export interface IRequestContextService {
    readonly context: IRequestContext;
}

/** @internal */
export interface IRequestContextBuilderRegistration {
    getCallbacks(): IRequestContextBuilderMap;
    register(name: string, callback: IRequestContextBuilderCallback): void; 
}

/** @internal */
export const IRequestContextBuilder = createService<IRequestContextBuilder>("request-context-builder");
/** @internal */
export const IRequestContextBuilderRegistration = createService<IRequestContextBuilderRegistration>("request-context-registration");
export const IRequestContextService = createService<IRequestContextService>("request-context-service");

/** @internal */
@Singleton
export class RequestContextBuilderRegistration implements IRequestContextBuilderRegistration {
    private readonly map: Mutable<IRequestContextBuilderMap> = {};

    getCallbacks(): IRequestContextBuilderMap {
        return this.map;
    }

    register(name: string, callback: IRequestContextBuilderCallback): void {
        this.map[name] = callback;
    }
}

// the request context service is responsible for holding a reference to the current request context
// and making it available publicly through the service

// the request builder is responsible for building/modifying the request context and is used by
// express middleware that handle extending the request context

/** @internal */
@Scoped
export class RequestContextService implements IRequestContextService {
    private current: IRequestContext;

    constructor(@IServiceCollection services: IServiceCollection) {
        this.current = { bag: {}, services };
    }

    get context(): IRequestContext {
        return this.current;
    }

    setCurrentContext(current: IRequestContext): void {
        this.current = current;
    }
}

/** @internal */
@Scoped
export class RequestContextBuilder implements IRequestContextBuilder {
    constructor(
        @IRequestContextBuilderRegistration builders: IRequestContextBuilderRegistration,
        @IRequestContextService service: RequestContextService) {
            const map = builders.getCallbacks();

            // TODO: can this be more efficient? -- is there a better way than to loop through and copy each function?
            // extend the current instance to include the registered builder callbacks
            for (const name in map) {
                (<any>this)[name] = (...args: any[]) => {
                    service.setCurrentContext(map[name](service.context, ...args));
                    return this;
                };
            }
    }
}