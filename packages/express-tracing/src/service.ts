import { Request, Response } from "express";
import { createService, Singleton } from "@shrub/core";
import { IRequestContext } from "@shrub/express";
import { ISpan, ITags, ITracerBuilder, ITracingService } from "@shrub/tracing";

type Mutable<T> = {-readonly[P in keyof T]: T[P]};

/** Internal service used by the middleware for starting and ending spans. */
export interface IExpressTracingService {
    endSpan(span: ISpan, req: Request, res: Response): void;
    startSpan(req: Request, options?: IRequestTracingOptions): ISpan;
}

export interface IRequestTracingOptions {
    /** 
     * True if the requests are expected to be from an external client and will disable searching the
     * request for the X-Trace-ID and X-Span-ID headers; the default is false.
     */
    readonly external?: boolean;
}

export enum TraceHeaders {
    traceId = "X-Trace-ID",
    spanId = "X-Span-ID"
}

export const IExpressTracingService = createService<IExpressTracingService>("express-tracing-service");

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
            ? this.getExternalBuilder()
            : this.getInternalBuilder();

        const tags: ITags = {
            "http.url": req.originalUrl,
            "http.method": req.method
        };

        this.addHeaderFieldTag(tags, req, "http.id", "X-Request-ID");
        return builder.build(req).startSpan("http.request", tags);
    }

    endSpan(span: ISpan, req: Request, res: Response): void {
        span.tag("http.status", res.statusCode);
        span.done(req.context.bag.__error);
    }

    private getExternalBuilder(): ITracerBuilder {
        this.externalBuilder = this.externalBuilder || this.tracingService.getBuilder();
        return this.externalBuilder;
    }

    private getInternalBuilder(): ITracerBuilder {
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

    private addHeaderFieldTag(tags: Mutable<ITags>, req: Request, tagName: string, headerName: string): void {
        const value = req.get(headerName);
        if (value !== undefined) {
            tags[tagName] = value;
        }
    }
}