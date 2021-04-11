import { createInjectable, createService, IInjectable, IServiceCollection, Singleton } from "@shrub/core";
import { IRequestContext } from "@shrub/express";
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
    registerProxy<T>(key: string, factory: IProxyFactory<T>): void;
}

export const IProxyService = createService<IProxyService>("proxy-service");

/** Creates an injectable proxy used to define proxy interfaces and can be used as a decorator to inject proxies into service instances. */
export function createProxyType<T>(key: string): IProxyType<T> {
    return createInjectable({
        key,
        factory: services => services.get(IProxyService).getProxy<T>(key)
    });
}

/** Base class for a local proxy that act as a gateway between hosted in the same process. */
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

@Singleton
export class ProxyService implements IProxyService {
    private readonly proxies = new Map<string, IProxyFactory<any>>();

    constructor(@IServiceCollection private readonly services: IServiceCollection) {
    }

    getProxy<T>(key: string): T {
        const factory = this.proxies.get(key);

        if (!factory) {
            throw new Error(`Proxy for key (${key}) not registered, proxy types must be registered with the express-proxy module to be used.`);
        }

        return factory(this.services);
    }

    registerProxy<T>(key: string, factory: IProxyFactory<T>): void {
        this.proxies.set(key, factory);
    }
}