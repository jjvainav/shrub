import { createInjectable, createService, IInjectable, IServiceCollection, Singleton, Transient } from "@shrub/core";
import { IRequestContext } from "@shrub/express";
import client, { IRequest, IRequestClient } from "@sprig/request-client";
import { RequestClientConstructor } from "@sprig/request-client-class";
import { Request, RequestHandler, Response } from "express";

export interface IExpressRequestOptions {
    readonly context: IRequestContext;
    readonly handler: RequestHandler;
    readonly body?: any;
    readonly params?: any;
    readonly query?: any;
}

export interface IExpressResponse {
    readonly status: number;
    readonly data: any;
}

/** A callback responsible for preparing a request to be invoked on behalf of a current request context. */
export interface IPrepareClientRequest {
    (context: IRequestContext, request: IRequest): IRequest;
}

/** Defines an injectable proxy that represents proxy instances of type T. */
export interface IProxyType<T> extends IInjectable<T> {
}

/** Factory function for creating proxy instances. */
export interface IProxyFactory<T> {
    (services: IServiceCollection): T;
}

/** A service for registering and managing proxies. */
export interface IProxyService {
    getProxy<T>(key: string): T;
}

/** @internal */
export interface IProxyRegistrationService {
    getFactory<T>(key: string): IProxyFactory<T> | undefined;
    registerProxy<T>(key: string, factory: IProxyFactory<T>): void;
}

export const IProxyService = createService<IProxyService>("proxy-service");
/** @internal */
export const IProxyRegistrationService = createService<IProxyRegistrationService>("proxy-registration-service");

/** Creates an injectable proxy used to define proxy interfaces and can be used as a decorator to inject proxies into service instances. */
export function createProxyType<T>(key: string): IProxyType<T> {
    return createInjectable({ key, factory: services => services.get(IProxyService).getProxy<T>(key) });
}

/** Base class for a local proxy where the API module is hosted in the same process. */
export abstract class LocalProxy {
    /** Invokes an express request handler directly and returns a result. */
    protected invokeRequest(options: IExpressRequestOptions): Promise<IExpressResponse> {
        return new Promise((resolve, reject) => options.handler(
            this.createExpressRequest(options),
            this.createExpressResponse(resolve),
            (reason: any) => {
                if (reason) {
                    // assume next is only invoked if there is an error
                    reject(reason);
                }
            }));
    }

    private createExpressRequest(options: IExpressRequestOptions): Request {
        return <Request><unknown>{
            context: options.context,
            handler: options.handler,
            body: options.body,
            params: options.params,
            query: options.query
        };
    }

    private createExpressResponse(callback: (response: IExpressResponse) => void): Response {
        let status = 200;
        return <Response>{
            json: function (body): Response {
                return this.send(body);
            },
            send: function (body): Response {
                callback({ status, data: body });
                return this;
            },
            sendStatus: function (s): Response {
                status = s;
                return this.send();
            },
            status: function (s): Response {
                status = s;
                return this;
            }
        };
    }
}

/** Base class for a remote proxy where the API is accessed via an external REST endpoint. */
export abstract class RemoteProxy<TClient> {
    constructor(
        private readonly url: string, 
        private readonly requestClientConstructor: RequestClientConstructor<TClient>,
        private readonly prepareRequest?: IPrepareClientRequest,
        private readonly prepareStream?: IPrepareClientRequest) {
    }

    /** Creates a new request client class instance for the proxy. */
    protected createClient(context: IRequestContext): TClient {
        const prepareRequest = this.prepareRequest;
        const prepareStream = this.prepareStream;
        
        const requestClient: IRequestClient = {
            request: prepareRequest && (options => prepareRequest(context, client.request(options))) || client.request,
            stream: prepareStream && (options => prepareStream(context, client.stream(options))) || client.stream,
        };

        return new this.requestClientConstructor({ url: this.url, client: requestClient });
    }
}

/** @internal */
@Transient
export class ProxyService implements IProxyService {
    constructor(@IServiceCollection private readonly services: IServiceCollection) {
    }

    getProxy<T>(key: string): T {
        const factory = this.services.get(IProxyRegistrationService).getFactory<T>(key);

        if (!factory) {
            throw new Error(`Proxy for key (${key}) not registered, proxy types must be registered with the express-proxy module to be used.`);
        }

        return factory(this.services);
    }
}

/** @internal */
@Singleton
export class ProxyRegistrationService implements IProxyRegistrationService {
    private readonly proxies = new Map<string, IProxyFactory<any>>();

    getFactory<T>(key: string): IProxyFactory<T> | undefined {
        return this.proxies.get(key);
    }

    registerProxy<T>(key: string, factory: IProxyFactory<T>): void {
        this.proxies.set(key, factory);
    }
}