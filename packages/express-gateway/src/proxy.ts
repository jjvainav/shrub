import { createInjectable, IInjectable, IServiceCollection } from "@shrub/core";
import { ControllerInvokerConstructor, IControllerInvokerService, IRequestContext } from "@shrub/express";
import client, { IRequest, IRequestClient } from "@sprig/request-client";
import { RequestClientConstructor } from "@sprig/request-client-class";
import { RequestHandler } from "express";

/** The client type for a proxy. */
export type ProxyClient<T> = T extends IProxy<infer C> ? C : never;
export type ProxyFactory<TProxy extends IProxy<TClient>, TClient = ProxyClient<TProxy>> = (services: IServiceCollection) => TProxy;

/** A callback responsible for preparing a request to be invoked on behalf of a current request context. */
export interface IPrepareClientRequest {
    (context: IRequestContext, request: IRequest): IRequest;
}

/** Defines an object responsible for forwarding requests to another Api endpoint. */
export interface IProxyType<TProxy extends IProxy<TClient>, TClient> extends IInjectable<TProxy> {
}

/** Defines an object responsible for forwarding requests from one Api endpoint to another. */
export interface IProxy<TClient> {
    /** Create a client for that can be invoked on behalf of the specified request context. */
    createClient(context: IRequestContext): TClient;
}

/** Defines options for a remote proxy. */
export interface IRemoteProxyOptions {
    readonly url: string;
    readonly prepareRequest?: IPrepareClientRequest;
    readonly prepareStream?: IPrepareClientRequest;
}

/** Creates an injectable proxy. */
export function createProxy<TProxy extends IProxy<TClient>, TClient = ProxyClient<TProxy>>(key: string): IProxyType<TProxy, TClient> {
    return createInjectable({ 
        key, 
        configurable: true,
        factory: () => { throw new Error(`Proxy for key (${key}) not registered, proxy types must be registered with the express-gateway module to be used.`); }
    });
}

/** A proxy where the client and enpoint are hosted in the same process. */
export class LocalProxy<TClient> implements IProxy<TClient> {
    constructor(
        private readonly controllerInvokerConstructor: ControllerInvokerConstructor<TClient>,
        private readonly handler?: RequestHandler) {
    }

    createClient(context: IRequestContext): TClient {
        return context.services.get(IControllerInvokerService).createControllerInvoker(this.controllerInvokerConstructor, this.handler);
    }
}

/** A proxy where the client accesses an external REST endpoint. */
export class RemoteProxy<TClient> implements IProxy<TClient> {
    constructor(
        private readonly requestClientConstructor: RequestClientConstructor<TClient>,
        private readonly options: IRemoteProxyOptions) {
    }

    createClient(context: IRequestContext): TClient {
        const prepareRequest = this.options.prepareRequest;
        const prepareStream = this.options.prepareStream;
        
        const requestClient: IRequestClient = {
            request: prepareRequest && (options => prepareRequest(context, client.request(options))) || client.request,
            stream: prepareStream && (options => prepareStream(context, client.stream(options))) || client.stream,
        };

        return new this.requestClientConstructor({ url: this.options.url, client: requestClient });
    }
}