import { Request } from "express";
import { createService, Singleton } from "@shrub/core";
import { IRequestContext } from "@shrub/express";
import { ISpan, ITracerBuilder, ITracingService } from "@shrub/tracing";

export enum TraceHeaders {
    traceId = "X-Trace-ID",
    spanId = "X-Span-ID"
}

export const IExpressTracingService = createService<IExpressTracingService>("express-tracing-service");

export interface IExpressTracingService {
    startSpan(req: Request, options?: IRequestTracingOptions): ISpan;
}

export interface IRequestTracingOptions {
    /** 
     * True if the requests are expected to be from an external client and will disable searching the
     * request for the X-Trace-ID and X-Span-ID headers; the default is false.
     */
    readonly external?: boolean;
}

function isRequestContextScope(scope: any): scope is IRequestContext {
    return (<IRequestContext>scope).bag !== undefined && (<IRequestContext>scope).services !== undefined;
}

function isRequestScope(scope: any): scope is Request {
    return (<Request>scope).url !== undefined && (<Request>scope).method !== undefined;
}

@Singleton
export class ExpressTracingService implements IExpressTracingService {
    private externalBuilder?: ITracerBuilder;
    private internalBuilder?: ITracerBuilder;

    constructor(@ITracingService private readonly tracingService: ITracingService) {
    }

    startSpan(req: Request, options?: IRequestTracingOptions): ISpan {
        const builder = options && options.external
            ? this.getExternalBuilder(req)
            : this.getInternalBuilder(req);

        const tracer = builder.build(req);
        const span = tracer.startSpan("http.request");
        const requestId = req.get("X-Request-ID");

        span.tag("http.url", req.originalUrl);
        span.tag("http.method", req.method);

        if (requestId) {
            span.tag("http.id", requestId);
        }

        return span;
    }

    private getExternalBuilder(req: Request): ITracerBuilder {
        this.externalBuilder = this.externalBuilder || this.tracingService.getBuilder();
        return this.externalBuilder;
    }

    private getInternalBuilder(req: Request): ITracerBuilder {
        this.internalBuilder = this.internalBuilder || this.tracingService.getBuilder().useContextProvider({
            getSpanContext: scope => {
                if (isRequestScope(scope)) {
                    const traceId = scope.get(TraceHeaders.traceId);
                    const scopeId = scope.get(TraceHeaders.spanId);
        
                    if (traceId && scopeId) {
                        return {
                            getParentSpanId: () => scopeId,
                            getTraceId: () => traceId
                        }
                    }
                }
                else if (isRequestContextScope(scope) && scope.span) {
                    const scopeId = scope.span.id;
                    const traceId = scope.span.traceId;
                    return {
                        getParentSpanId: () => scopeId,
                        getTraceId: () => traceId
                    }
                }
        
                return undefined;
            }
        });

        return this.internalBuilder;
    }
}