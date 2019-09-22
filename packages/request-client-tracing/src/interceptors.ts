import { ISpan } from "@shrub/tracing";
import { IRequestInterceptor, IResponseInterceptor, IResponseInterceptorContext, isExpectedStatus } from "@sprig/request-client";

// Note: the interceptors support an undefined span; if one is provided a 'noOp' interceptor is returned.
// This is useful in situations where users can turn on/off tracing by simply passing a span or undefined.
const noOp = (context: any) => context.next();

/** Creates a new request interceptor that will log request info to the provided span. */
export function logRequest(span?: ISpan): IRequestInterceptor {
    return !span ? noOp : context => {
        span.logInfo({
            name: "request",
            url: context.request.options.url,
            method: context.request.options.method,
            headers: context.request.options.headers
        });

        context.next();
    };
}

/** 
 * Creates a new response interceptor that will log response info to the provided span. 
 * Note, this only logs if a response was received from the end point and does not log
 * the request error if one had occurred and the request failed.
 */
export function logResponse(span?: ISpan): IResponseInterceptor {
    return !span ? noOp : context => {
        if (context.response) {
            let data: any = {
                name: "response",
                request_id: context.request.id,
                status: context.response.status
            };

            if (shouldLogResponseWarning(context)) {
                // only log the response body for unexpected responses and also log it as a warning
                data = { ...data, body: context.response.data };
                span.logWarn(data);
            }
            else {
                span.logInfo(data);
            }
        }
        
        context.next();
    };
}

/** Injects request header fields for the specified span. */
export function tracingHeaders(span?: ISpan): IRequestInterceptor {
    return !span ? noOp : context => {
        context.next({
            ...context,
            request: context.request
                .withHeader("X-Span-ID", span.id)
                .withHeader("X-Trace-ID", span.traceId)
        });
    };
}

function shouldLogResponseWarning(context: IResponseInterceptorContext): boolean {
    // any 4xx and above status code that was not expected by the request
    return context.response !== undefined && context.response.status >= 400 && !isExpectedStatus(context.request, context.response.status);
}