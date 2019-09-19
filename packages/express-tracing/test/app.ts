import { Request, Response, NextFunction } from "express";
import { ExpressFactory, IExpressApplication, IExpressConfiguration } from "@shrub/express";
import { EventEmitter } from "@sprig/event-emitter";
import { ExpressTracingModule, IRequestTracingOptions, useRequestTracing } from "../src";

export interface ITestContext {
    readonly app: IExpressApplication;
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
    return ExpressFactory
        .useModules([{
            name: "Test",
            dependencies: [ExpressTracingModule],
            configure: ({ config }) => {
                const app = config.get(IExpressConfiguration);
                
                app.use(useRequestTracing(options && options.tracing));

                app.get(
                    "/test",
                    (req: Request, res: Response, next: NextFunction) => {
                        startEmitter.emit(req);
                        res.once("finish", () => endEmitter.emit(req));
    
                        next(options && options.err);
                    },
                    (req, res) => {
                        req.context.span!.logInfo({ message: "foo" });
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
            onRequestStart: cb => startEmitter.event(cb),
            onRequestEnd: cb => endEmitter.event(cb)
        }));
}