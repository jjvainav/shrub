import { createInjectable, IInjectable } from "@shrub/core";
import { ControllerInvokerConstructor, IControllerInvokerService, IRequestContext } from "@shrub/express";
import client, { IRequest, IRequestClient } from "@sprig/request-client";
import { RequestClientConstructor } from "@sprig/request-client-class";
import { RequestHandler } from "express";

/** A callback responsible for preparing a request to be invoked on behalf of a current request context. */
export interface IPrepareClientRequest {
    (context: IRequestContext, request: IRequest): IRequest;
}

/** Defines an injectable proxy that represents proxy instances of type T. */
export interface IProxyType<T> extends IInjectable<T> {
}

/** Defines options for a remote proxy. */
export interface IRemoteProxyOptions {
    readonly url: string;
    readonly prepareRequest?: IPrepareClientRequest;
    readonly prepareStream?: IPrepareClientRequest;
}

/** Creates an injectable proxy used to define proxy interfaces and can be used as a decorator to inject proxies into service instances. */
export function createProxyType<T>(key: string): IProxyType<T> {
    return createInjectable({ 
        key, 
        configurable: true,
        factory: () => { throw new Error(`Proxy for key (${key}) not registered, proxy types must be registered with the express-proxy module to be used.`); }
    });
}

/** Base class for a local proxy where the API module is hosted in the same process. */
export abstract class LocalProxy<TClient> {
    constructor(
        private readonly controllerInvokerConstructor: ControllerInvokerConstructor<TClient>,
        private readonly handler?: RequestHandler) {
    }

    protected createClient(context: IRequestContext): TClient {
        return context.services.get(IControllerInvokerService).createControllerInvoker(this.controllerInvokerConstructor, this.handler);
    }
}

/** Base class for a remote proxy where the API is accessed via an external REST endpoint. */
export abstract class RemoteProxy<TClient> {
    constructor(
        private readonly requestClientConstructor: RequestClientConstructor<TClient>,
        private readonly options: IRemoteProxyOptions) {
    }

    /** Creates a new request client class instance for the proxy. */
    protected createClient(context: IRequestContext): TClient {
        const prepareRequest = this.options.prepareRequest;
        const prepareStream = this.options.prepareStream;
        
        const requestClient: IRequestClient = {
            request: prepareRequest && (options => prepareRequest(context, client.request(options))) || client.request,
            stream: prepareStream && (options => prepareStream(context, client.stream(options))) || client.stream,
        };

        return new this.requestClientConstructor({ url: this.options.url, client: requestClient });
    }
}