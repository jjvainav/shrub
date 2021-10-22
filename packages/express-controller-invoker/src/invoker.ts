import { createInjectable, createService, IInjectable, Singleton, Transient } from "@shrub/core";
import { controller, Constructor, IExpressApplication } from "@shrub/express";
import { Request, RequestHandler, Response } from "express";
import { PathParams } from "express-serve-static-core";

export type ControllerInvokerConstructor<T> = { new(options: IControllerInvokerOptions): T };

/** Defines options for a controller invoker. */
export interface IControllerInvokerOptions {
    readonly app: IExpressApplication;
    readonly handler?: RequestHandler;
}

/** @internal Factory function for creating controller invoker instances. */
export interface IControllerInvokerFactory<T> {
    (): T;
}

/** Defines an injectable controller invoker that represents controller invoker instances of type T. */
export interface IControllerInvokerType<T> extends IInjectable<T> {
}

/** A service for registering and managing controller invokers. */
export interface IControllerInvokerService {
    getControllerInvoker<T>(key: string): T;
}

/** @internal */
export interface IControllerInvokerRegistrationService {
    getFactory<T>(key: string): IControllerInvokerFactory<T> | undefined;
    registerControllerInvoker<T>(key: string, factory: IControllerInvokerFactory<T>): void;
}

/** Defines options for invoking a controller action. */
export interface IControllerRequestOptions<TController> {
    readonly controller: Constructor<TController>;
    readonly method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
    readonly path: PathParams;
    readonly body?: any;
}

/** Defines the response from invoking a controller action. */
export interface IControllerResponse {
    readonly status: number;
    readonly data: any;
}

export const IControllerInvokerService = createService<IControllerInvokerService>("controller-invoker-service");
/** @internal */
export const IControllerInvokerRegistrationService = createService<IControllerInvokerRegistrationService>("controller-invoker-registration-service");

/** Creates an injectable controller-invoker used to define controller invoker interfaces and can be used as a decorator to inject controller invokers into service instances. */
export function createControllerInvokerType<T>(key: string): IControllerInvokerType<T> {
    return createInjectable({ key, factory: services => services.get(IControllerInvokerService).getControllerInvoker<T>(key) });
}

/** A class that is responsible for exposing and invoking controller actions. */
export abstract class ControllerInvoker {
    private readonly handler: RequestHandler;

    constructor(private readonly options: IControllerInvokerOptions) {
        this.handler = !options.handler ? (_, __, next) => next() : options.handler;
    }

    /** Invokes an express request handler directly which represents a single controller action and returns a result. */
    protected invokeAction<TController>(options: IControllerRequestOptions<TController>): Promise<IControllerResponse> {
        const router = controller(options.controller);
        return new Promise((resolve, reject) => {
            // create the express Request object to pass down the request chain
            const req = this.createExpressRequest(options);
            // create the express Response object that will resovle the Promise when the response has ended (i.e. when res.end is inovked)
            const res = this.createExpressResponse(resolve);
            // if an error is returned at any point reject the promise
            const nextOrReject = (err: any, next: () => void) => {
                if (err) {
                    reject(err);
                }
                else {
                    next();
                }
            };

            this.options.app(req, res, (err: any) => nextOrReject(err, () => {
                // the handler is the custom handler provided to the controller invoker, this allows configuring the express middleware before invoking the controller
                // the router handles invoking the controller and if next is invoked assume an error or a 404
                this.handler(req, res, (err: any) => nextOrReject(err, () => router(req, res, (err: any) => reject(err || new Error(`Path ${options.path} not found.`)))));
            }));
        });
    }

    private createExpressRequest<TController>(options: IControllerRequestOptions<TController>): Request {
        return <Request><unknown>{
            method: options.method,
            body: options.body,
            url: options.path
        };
    }

    private createExpressResponse(callback: (response: IControllerResponse) => void): Response {
        let headers: any = {};
        let status = 200;
        return <Response>{
            get statusCode() {
                return status;
            },
            set statusCode(s) {
                this.status(status);
            },
            end: function (data: any, _: BufferEncoding, cb?: (() => void)): void {
                callback({ status, data });
                
                if (cb) {
                    cb();
                }
            },
            getHeader: name => headers[name],
            json: function (data): Response {
                return this.send(data);
            },
            send: function (data): Response {
                this.end(data);
                return this;
            },
            sendStatus: function (s): Response {
                status = s;
                return this.send();
            },
            setHeader: function (name: string, value: any): void {
                headers[name] = value;
            },
            status: function (s): Response {
                status = s;
                return this;
            },
            write: function (data: any, _: BufferEncoding, cb?: ((error: Error | null | undefined) => void)): void {
                this.end(data);
                
                if (cb) {
                    cb(undefined);
                }
            },
        };
    }
}

/** @internal */
@Transient
export class ControllerInvokerService implements IControllerInvokerService {
    constructor(@IControllerInvokerRegistrationService private readonly registry: IControllerInvokerRegistrationService) {
    }

    getControllerInvoker<T>(key: string): T {
        const factory = this.registry.getFactory<T>(key);

        if (!factory) {
            throw new Error(`ControllerInvoker for key (${key}) not registered, invoker types must be registered with the express-controller-invoker module to be used.`);
        }

        return factory();
    }
}

/** @internal */
@Singleton
export class ControllerInvokerRegistrationService implements IControllerInvokerRegistrationService {
    private readonly invokers = new Map<string, IControllerInvokerFactory<any>>();

    getFactory<T>(key: string): IControllerInvokerFactory<T> | undefined {
        return this.invokers.get(key);
    }

    registerControllerInvoker<T>(key: string, factory: IControllerInvokerFactory<T>): void {
        this.invokers.set(key, factory);
    }
}