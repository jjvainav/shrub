import { NextFunction, Request, RequestHandler, Response } from "express";
import { ISpan } from "@shrub/tracing";
import { IExpressTracingService, IRequestTracingOptions } from "./service";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        readonly span?: ISpan;
    }
}

attachErrorListener();

/** Request tracing middleware that will start a new span for a request. */
export const useRequestTracing = (options?: IRequestTracingOptions): RequestHandler => {
    return (req, res, next) => {
        const span = req.context.services.get(IExpressTracingService).startSpan(req, options);
        (<any>req.context).span = span;

        // https://nodejs.org/api/http.html#http_event_finish
        res.once("finish", () => {
            if (res.statusCode >= 300 && res.statusCode < 400) {
                const location = res.getHeader("location");
                if (location) {
                    span.tag("http.location", location);
                }
            }

            span.tag("http.status", res.statusCode);
            span.done(req.context.bag.__error);
        });

        next();
    };
};

/** 
 * Overrides the express internal handle_error function that gets invoked when an error has occurred. 
 * There are no global error events exposed by express and the only way to handle errors is via express middleware.
 * By monkey patching the internal handle_error function we can 'listen' for errors and not have to worry
 * about error handling middleware not passing the error down to next.
 * 
 * Note: the node http request/response define an error event (e.g. req.on("error")) but these do not seem to get invoked.
 * 
 * https://github.com/expressjs/express/blob/3ed5090ca91f6a387e66370d57ead94d886275e1/lib/router/layer.js#L62
 */
function attachErrorListener(): void {
    const Layer = require("express/lib/router/layer");
    const ref = Layer.prototype.handle_error;
    Layer.prototype.handle_error = function handle_error(error: Error, req: Request, res: Response, next: NextFunction) {
        req.context.bag.__error = error;
        return ref.call(this, error, req, res, next);
    }
}