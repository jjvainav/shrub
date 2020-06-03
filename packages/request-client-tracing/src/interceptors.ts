import { IEventLogData, ISpan } from "@shrub/tracing";
import { IRequestInterceptor, IResponseInterceptor, IResponseInterceptorContext, isExpectedStatus } from "@sprig/request-client";

// Note: the interceptors support an undefined span; if one is provided a 'noOp' interceptor is returned.
// This is useful in situations where users can turn on/off tracing by simply passing a span or undefined.
const noOp = (context: any) => context.next();

/** Creates a new request interceptor that will log request info to the provided span. */
export function logRequest(span?: ISpan): IRequestInterceptor {
    return !span ? noOp : context => {
        const props: { [key: string]: string } = {
            url: context.request.options.url,
            method: <string>context.request.options.method
        };

        if (context.request.options.headers) {
            for (const key of Object.keys(context.request.options.headers)) {
                props["header." + key] = context.request.options.headers[key];
            }
        }

        span.logInfo(<IEventLogData>({ type: "event", name: "request", props }));
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
            const props: { [key: string]: string } = {
                request_id: context.request.id,
                status: context.response.status.toString()
            };

            const data: IEventLogData = { type: "event", name: "response", props };

            if (shouldLogResponseWarning(context)) {
                // only log the response body for unexpected responses and also log it as a warning
                props.body = JSON.stringify(context.response.data);
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