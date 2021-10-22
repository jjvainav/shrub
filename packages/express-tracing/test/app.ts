import { ExpressFactory, IExpressApplication, IExpressConfiguration } from "@shrub/express";
import { ILogEntry } from "@shrub/logging";
import { ISpan, ITags, ITraceWriter, ITracingConfiguration, TracingModule } from "@shrub/tracing";
import { EventEmitter } from "@sprig/event-emitter";
import { Request, Response, NextFunction } from "express";
import { ExpressTracingModule, IExpressSessionConfiguration, IRequestTracingOptions } from "../src";

type Mutable<T> = { -readonly[P in keyof T]: T[P] };

export interface ITestContext {
    readonly app: IExpressApplication;
    readonly traceWriter: MockTraceWriter;
    readonly onRequestStart: (cb: (req: Request) => void) => void;
    readonly onRequestEnd: (cb: (req: Request) => void) => void;
}

export interface ITestContextOptions {
    readonly err?: Error;
    readonly tracing?: IRequestTracingOptions;
}

export function createApp(options?: ITestContextOptions): Promise<ITestContext> {
    const startEmitter = new EventEmitter<Request>("request-start");
    const endEmitter = new EventEmitter<Request>("request-end");
    const traceWriter = new MockTraceWriter();

    return ExpressFactory
        .useModules([{
            name: "Test",
            dependencies: [
                ExpressTracingModule,
                TracingModule
            ],
            configure: ({ config }) => {
                config.get(IExpressSessionConfiguration).useRequestTracing(options && options.tracing || {});
                config.get(ITracingConfiguration).useTraceWriter(traceWriter);
                
                const app = config.get(IExpressConfiguration);
                app.get(
                    "/test",
                    (req: Request, res: Response, next: NextFunction) => {
                        startEmitter.emit(req);
                        res.once("finish", () => endEmitter.emit(req));
    
                        next(options && options.err);
                    },
                    (req, res) => {
                        req.context.span!.logInfo("foo");
                        res.status(204).end();
                    });
    
                app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
                    // inject an error handler middleware to test that errors are still being handled properly
                    // even if there is an error handler that does not invoke next
                    res.status(500).json({ message: err.message });
                });
            }
        }])
        .create()
        .then(app => ({
            app,
            traceWriter,
            onRequestStart: cb => startEmitter.event(cb),
            onRequestEnd: cb => endEmitter.event(cb)
        }));
}

export class MockTraceWriter implements ITraceWriter { 
    readonly start = new Set<ISpan>();
    readonly logs = new Map<ISpan, ILogEntry[]>();
    readonly tags = new Map<ISpan, ITags>();
    readonly done = new Set<ISpan>();

    writeStart(span: ISpan): void {
        this.start.add(span);
    }

    writeLog(span: ISpan, log: ILogEntry): void {
        const entries = this.logs.get(span) || [];
        this.logs.set(span, entries);
        entries.push(log);
    }

    writeTag(span: ISpan, key: string, value: string | number | boolean): void {
        const items = this.tags.get(span) || {};
        this.tags.set(span, items);
        (<Mutable<ITags>>items)[key] = value;
    }

    writeDone(span: ISpan): void {
        this.done.add(span);
    }
}