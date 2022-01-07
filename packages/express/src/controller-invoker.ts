import { createService, Transient } from "@shrub/core";
import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { PathParams } from "express-serve-static-core";
import { IExpressApplication } from "./app";
import { controller, Constructor } from "./controller";

export type ControllerInvokerConstructor<T> = { new(options: IControllerInvokerOptions): T };
export type ControllerErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction, retry: Function) => void;

/** Defines options for a controller invoker. */
export interface IControllerInvokerOptions {
    readonly app: IExpressApplication;
    readonly handler?: RequestHandler;
    readonly prepare?: RequestHandler;
    readonly error?: ControllerErrorRequestHandler;
}

/** Defines options when creating a new controller invoker. */
export interface ICreateControllerInvokerOptions {
    /** A handler that gets invoked prior to invoking the action but after any pre-configured application middleware. */
    readonly handler?: RequestHandler;
    /** A handler that gets invoked prior to invoking any middleware and is useful for pre-handling a request/response. */
    readonly prepare?: RequestHandler;
    /** 
     * A callback that will get called when a request generates an error and allows the ability to retry a request. 
     * Note: when retrying a request there is no need to invoke 'next'; the retry attempt will rebuild the request/response and invoke the request pipeline again.
     */
    readonly error?: ControllerErrorRequestHandler;
}

/** A service for creating controller invokers. */
export interface IControllerInvokerService {
    createControllerInvoker<T>(ctor: ControllerInvokerConstructor<T>, options?: ICreateControllerInvokerOptions): T;
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

/** A class that is responsible for exposing and invoking controller actions. */
export abstract class ControllerInvoker {
    private readonly handler: RequestHandler;
    private readonly prepare: RequestHandler;

    constructor(private readonly options: IControllerInvokerOptions) {
        this.handler = !options.handler ? (_, __, next) => next() : options.handler;
        this.prepare = !options.prepare ? (_, __, next) => next() : options.prepare;
    }

    /** Invokes an express request handler directly which represents a single controller action and returns a result. */
    protected invokeAction<TController>(options: IControllerRequestOptions<TController>): Promise<IControllerResponse> {
        const router = controller(options.controller);
        return new Promise((resolve, reject) => {
            // if an error is returned at any point reject the promise
            const nextOrReject: ErrorRequestHandler = (err, req, res, next) => {
                if (err) {
                    if (this.options.error) {
                        // 1) if the error handler invokes next reject using the provided error
                        // 2) there doesn't seem to be a good way to retry a request so call invokeAction to rebuild request/response and try again
                        this.options.error(err, req, res, (err2: any) => reject(err2), () => invokeAction());
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    next();
                }
            };

            const invokeAction = () => {
                // create the express Request object to pass down the request chain
                const req = this.createExpressRequest(options);
                // create the express Response object that will resovle the Promise when the response has ended (i.e. when res.end is inovked)
                const res = this.createExpressResponse(resolve);

                // first invoke prepare
                this.prepare(req, res, (err: any) => nextOrReject(err, req, res, () => {
                    // if successful, invoke the application middleware pipeline
                    this.options.app(req, res, (err: any) => nextOrReject(err, req, res, () => {
                        // next, invoke the handler prior to invoking the route/controller
                        // the router handles invoking the controller and if next is invoked assume an error or a 404
                        this.handler(req, res, (err: any) => nextOrReject(err, req, res, () => router(req, res, (err: any) => {
                            err = err || new Error(`Path ${options.path} not found.`);
                            nextOrReject(err, req, res, () => reject(new Error("Failed to process request successfully.")));
                        })));
                    }));
                }));
            };

            invokeAction();
        });
    }

    private createExpressRequest<TController>(options: IControllerRequestOptions<TController>): Request {
        return <Request><unknown>{
            headers: {},
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
    constructor(@IExpressApplication private readonly app: IExpressApplication) {
    }

    createControllerInvoker<T>(ctor: ControllerInvokerConstructor<T>, options?: ICreateControllerInvokerOptions): T {
        return new ctor({ 
            app: this.app, 
            handler: options && options.handler, 
            prepare: options && options.prepare,
            error: options && options.error
        });
    }
}