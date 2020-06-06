import { ISpan } from "@shrub/tracing";
import { IRequestInterceptor } from "@sprig/request-client";

const noOp = (context: any) => context.next();

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