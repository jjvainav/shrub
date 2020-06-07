import { ILogEvent } from "@shrub/logging";
import { ISpan } from "@shrub/tracing";
import request from "supertest";
import { TraceHeaders } from "../src";
import { createApp } from "./app";

describe("express tracing middleware", () => {
    test("with request that returns a success status code and has no span context", async () => {
        const context = await createApp();
        let startSpan: ISpan | undefined;
        let endSpan: ISpan | undefined;

        context.onRequestStart(req => startSpan = req.context.span);
        context.onRequestEnd(req => endSpan = req.context.span);

        await request(context.app).get("/test").set({ "X-Request-ID": "123" });

        if (!startSpan || !endSpan) {
            fail();
            return;
        }

        expect(startSpan).toBe(endSpan);
        
        expect(startSpan.name).toBe("http.request");
        expect(startSpan.parentId).toBeUndefined();
        expect(startSpan.endTime).toBeDefined();

        expect(context.traceWriter.logs.get(startSpan)).toHaveLength(1);
        expect(context.traceWriter.logs.get(startSpan)![0].data).toBe("foo");
        
        expect(Object.keys(context.traceWriter.tags.get(startSpan)!)).toHaveLength(4);
        expect(context.traceWriter.tags.get(startSpan)!["http.method"]).toBe("GET");
        expect(context.traceWriter.tags.get(startSpan)!["http.id"]).toBe("123");
        expect(context.traceWriter.tags.get(startSpan)!["http.url"]).toBe("/test");
        expect(context.traceWriter.tags.get(startSpan)!["http.status"]).toBe(204);
    });

    test("with request that returns a success status code and has a parent span context", async () => {
        const context = await createApp();
        let span: ISpan | undefined;

        context.onRequestStart(req => span = req.context.span);

        await request(context.app).get("/test").set({
            [TraceHeaders.traceId]: "trace-id",
            [TraceHeaders.spanId]: "span-id"
        });

        expect(span!.name).toBe("http.request");
        expect(span!.parentId).toBe("span-id");
        expect(span!.traceId).toBe("trace-id");
    });    

    test("with request that fails with an error", async () => {
        const context = await createApp({ err: new Error("Some error.") });
        let startSpan: ISpan | undefined;
        let endSpan: ISpan | undefined;

        context.onRequestStart(req => startSpan = req.context.span);
        context.onRequestEnd(req => endSpan = req.context.span);

        await request(context.app).get("/test"); 

        if (!startSpan || !endSpan) {
            fail();
            return;
        }

        expect(startSpan).toBe(endSpan);
        
        expect(startSpan.name).toBe("http.request");
        expect(startSpan.endTime).toBeDefined();

        expect(context.traceWriter.logs.get(startSpan)).toHaveLength(1);
        expect((<ILogEvent>context.traceWriter.logs.get(startSpan)![0].data).name).toBe("Error");
        expect((<ILogEvent>context.traceWriter.logs.get(startSpan)![0].data).message).toBe("Some error.");
        expect((<ILogEvent>context.traceWriter.logs.get(startSpan)![0].data).stack).toBeDefined();
        
        expect(Object.keys(context.traceWriter.tags.get(startSpan)!)).toHaveLength(4);
        expect(context.traceWriter.tags.get(startSpan)!["error"]).toBe(true);
        expect(context.traceWriter.tags.get(startSpan)!["http.method"]).toBe("GET");
        expect(context.traceWriter.tags.get(startSpan)!["http.url"]).toBe("/test");
        // note: the express-core package has middleware that will automatically set the status code to 500 if there is an error
        expect(context.traceWriter.tags.get(startSpan)!["http.status"]).toBe(500);
    });    

    test("with external request that returns a success status code and ignores trace/span headers", async () => {
        const context = await createApp({ tracing: { external: true } });
        let span: ISpan | undefined;

        context.onRequestStart(req => span = req.context.span);

        // for requests from external/public clients ignore the trace/span headers
        await request(context.app).get("/test").set({
            [TraceHeaders.traceId]: "trace-id",
            [TraceHeaders.spanId]: "span-id"
        });

        expect(span!.name).toBe("http.request");
        expect(span!.parentId).toBeUndefined();
        expect(span!.traceId).toBeDefined();
    });   
});