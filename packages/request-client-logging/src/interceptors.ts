import { ILogEvent, ILogger } from "@shrub/logging";
import { IRequestInterceptor, IResponseInterceptor, IResponseInterceptorContext, isExpectedStatus } from "@sprig/request-client";

type Mutable<T> = {-readonly[P in keyof T]: T[P]};

// Note: the interceptors support an undefined logger; if one is not provided a 'noOp' interceptor is returned.
// This is useful in situations where users can turn on/off tracing by simply passing a logger or undefined.
const noOp = (context: any) => context.next();

/** Creates a new request interceptor that will log request info to the provided logger. */
export function logRequest(logger?: ILogger): IRequestInterceptor {
    return !logger ? noOp : context => {
        const data: Mutable<ILogEvent> = { 
            name: "request",
            url: context.request.options.url,
            method: context.request.options.method
        };

        if (context.request.options.headers) {
            for (const key of Object.keys(context.request.options.headers)) {
                data["header." + key] = context.request.options.headers[key];
            }
        }

        logger.logInfo(data);
        context.next();
    };
}

/** 
 * Creates a new response interceptor that will log response info to the provided logger. 
 * Note, this only logs if a response was received from the end point and does not log
 * the request error if one had occurred and the request failed.
 */
export function logResponse(logger?: ILogger): IResponseInterceptor {
    return !logger ? noOp : context => {
        if (context.response) {
            const data: Mutable<ILogEvent> = { 
                name: "response",
                requestId: context.request.id,
                status: context.response.status
            };

            if (shouldLogResponseWarning(context)) {
                // only log the response body for unexpected responses and also log it as a warning
                data.body = JSON.stringify(context.response.data);
                logger.logWarn(data);
            }
            else {
                logger.logInfo(data);
            }
        }
        
        context.next();
    };
}

function shouldLogResponseWarning(context: IResponseInterceptorContext): boolean {
    // any 4xx and above status code that was not expected by the request
    return context.response !== undefined && context.response.status >= 400 && !isExpectedStatus(context.request, context.response.status);
}