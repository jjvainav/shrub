import { ILogEntry, ILogEvent, LoggingService } from "@shrub/logging";
import { ISpan, ITags, ITraceWriter, TracingService } from "../src";

type Mutable<T> = { -readonly[P in keyof T]: T[P] };

function mockDateNow(now: number): () => void {
    const nowfn = Date.now;
    Date.now = jest.fn(() => now);
    return () => Date.now = nowfn;
}

class MockTraceWriter implements ITraceWriter { 
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

describe("tracing", () => {
    test("create root span", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService(new LoggingService());
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        unmock();

        expect(span.id).toHaveLength(16);
        expect(span.traceId).toHaveLength(22);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(now);
        expect(span.endTime).toBeUndefined();
    });

    test("create root span with tags", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test", { tag: "foo" });

        unmock();

        expect(span.id).toHaveLength(16);
        expect(span.traceId).toHaveLength(22);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(now);
        expect(span.endTime).toBeUndefined();
        expect(writer.tags.get(span)!.tag).toBe("foo");
    });

    test("create and finish root span", () => {
        const start = 1562602719878;
        const unmockStart = mockDateNow(start);

        const service = new TracingService(new LoggingService());
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        unmockStart();

        const end = start + 1000;
        const unmockEnd = mockDateNow(end);

        span.done();

        unmockEnd();

        expect(span.id).toHaveLength(16);
        expect(span.traceId).toHaveLength(22);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(start);
        expect(span.endTime).toBe(end);
    });

    test("create and finish root span with error", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");
        const err = new Error("An error occurred.");

        span.done(err);

        // make sure the end time is still getting set
        expect(span.endTime).toBeDefined();
        
        const logs = writer.logs.get(span)!;
        const tags = writer.tags.get(span)!;

        expect(logs).toHaveLength(1);
        expect((<ILogEvent>logs[0].data).name).toBe("Error");
        expect((<ILogEvent>logs[0].data).message).toBe("An error occurred.");
        expect((<ILogEvent>logs[0].data).stack).toBeDefined();
        
        expect(Object.keys(tags)).toHaveLength(1);
        expect(tags.error).toBe(true);
    });
    
    test("create and finish root span with error using custom converter", () => {
        const loggingService = new LoggingService();
        const tracingService = new TracingService(loggingService);
        const writer = new MockTraceWriter();

        tracingService.useTraceWriter(writer);
        loggingService.useErrorConverter(obj => {
            return {
                name: "FooError",
                message: obj.message, 
                stack: obj.stack,
                foo: "foo"
            };
        });

        const tracer = tracingService.getTracer();
        const span = tracer.startSpan("test");
        const err = new Error("An error occurred.");

        span.done(err);

        const logs = writer.logs.get(span)!;

        expect(logs).toHaveLength(1);
        expect((<ILogEvent>logs[0].data).name).toBe("FooError");
        expect((<ILogEvent>logs[0].data).message).toBe("An error occurred.");
        expect((<ILogEvent>logs[0].data).stack).toBeDefined();
        expect((<ILogEvent>logs[0].data).foo).toBe("foo");
    });  

    test("create multiple root spans", () => {
        const service = new TracingService(new LoggingService());
        const tracer = service.getTracer();

        const span1 = tracer.startSpan("test 1");
        const span2 = tracer.startSpan("test 2");

        expect(span1.id).toBeDefined();
        expect(span1.traceId).toBeDefined();
        expect(span1.parentId).toBeUndefined();
        expect(span1.name).toBe("test 1");

        expect(span2.id).toBeDefined();
        expect(span2.traceId).toBeDefined();
        expect(span2.parentId).toBeUndefined();
        expect(span2.name).toBe("test 2");

        // the tracer had an empty scope (i.e. not scoped to an existing span) so all spans started will be root spans
        expect(span1.traceId).not.toBe(span2.traceId);
    });  
    
    test("create child span", () => {
        const service = new TracingService(new LoggingService());

        const root = service.getTracer().startSpan("root");
        const child = service.getTracer(root).startSpan("child");

        expect(root.id).toBeDefined();
        expect(root.traceId).toBeDefined();
        expect(root.parentId).toBeUndefined();
        expect(root.name).toBe("root");

        expect(child.id).toBeDefined();
        expect(child.traceId).toBeDefined();
        expect(child.parentId).toBe(root.id);
        expect(child.name).toBe("child");

        expect(child.traceId).toBe(root.traceId);
    });

    test("create child span from custom scope", () => {
        const service = new TracingService(new LoggingService());
        const scope = { parentId: "1", traceId: "2" };

        service.useContextProvider({
            getSpanContext: scope => ({
                getParentSpanId: () => scope.parentId,
                getTraceId: () => scope.traceId
            })
        });

        const child = service.getTracer(scope).startSpan("child");

        expect(child.id).toBeDefined();
        expect(child.traceId).toBe("2");
        expect(child.parentId).toBe("1");
        expect(child.name).toBe("child");
    });

    test("create root and child spans with start/done writer", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const root = service.getTracer().startSpan("root");
        const child = service.getTracer(root).startSpan("child");

        child.done();
        root.done();

        expect(writer.start.has(root)).toBe(true);
        expect(writer.start.has(child)).toBe(true);

        expect(writer.done.has(root)).toBe(true);
        expect(writer.done.has(child)).toBe(true);
    }); 
    
    test("create span with context provider that doesn't recognize scope", () => {
        const service = new TracingService(new LoggingService());

        service.useContextProvider({
            getSpanContext: () => undefined
        });

        const root = service.getTracer().startSpan("root");

        expect(root.id).toBeDefined();
        expect(root.traceId).toBeDefined();
        expect(root.parentId).toBeUndefined();
    });

    test("create span with multiple context providers", () => {
        const service = new TracingService(new LoggingService());

        service.useContextProvider({
            getSpanContext: () => ({
                getParentSpanId: () => "a",
                getTraceId: () => "b"
            })
        });

        service.useContextProvider({
            getSpanContext: () => ({
                getParentSpanId: () => "1",
                getTraceId: () => "2"
            })
        });

        const child = service.getTracer().startSpan("child");

        // the first context provider to return a span context wins
        expect(child.id).toBeDefined();
        expect(child.traceId).toBe("b");
        expect(child.parentId).toBe("a");
    });

    test("add event object info log to span", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ 
            name: "foo-event",
            foo: "foo" 
        });

        unmock();

        const logs = writer.logs.get(span)!;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(20);
        expect((<ILogEvent>logs[0].data).name).toBe("foo-event");
        expect((<ILogEvent>logs[0].data).foo).toBe("foo");
        expect(logs[0].timestamp).toBe(now);
    });   
    
    test("add error log to span", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logError(new Error("Error test."));

        const logs = writer.logs.get(span)!;
        const tags = writer.tags.get(span)!;

        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(40);
        expect((<ILogEvent>logs[0].data).name).toBe("Error");
        expect((<ILogEvent>logs[0].data).message).toBe("Error test.");
        expect((<ILogEvent>logs[0].data).stack).toBeDefined();

        expect(Object.keys(tags)).toHaveLength(1);
        expect(tags.error).toBe(true);        
    });

    test("add error log to span for error that does not properly extend the Error class", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logError(new class extends Error {
            constructor() {
                super("Foo");
                // by not setting the classes prototype an instanceof Error check will fail
                // https://stackoverflow.com/a/41102306
            }
        });

        const logs = writer.logs.get(span)!;
        const tags = writer.tags.get(span)!;

        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(40);
        expect((<ILogEvent>logs[0].data).name).toBe("Error");
        expect((<ILogEvent>logs[0].data).message).toBe("Foo");
        expect((<ILogEvent>logs[0].data).stack).toBeDefined();

        expect(Object.keys(tags)).toHaveLength(1);
        expect(tags.error).toBe(true);     
    });  

    test("add log to span with custom level", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.log(11, { 
            name: "test",
            foo: "foo" 
        });

        const logs = writer.logs.get(span)!;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(11);
        expect((<ILogEvent>logs[0].data).name).toBe("test");
        expect((<ILogEvent>logs[0].data).foo).toBe("foo");
    });

    test("add log to span with string data", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();
        service.useTraceWriter(writer);

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo("foo");

        const logs = writer.logs.get(span)!;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(20);
        expect(logs[0].data).toBe("foo");
    });  
    
    test("extend tracer with custom builder and writer", () => {
        const service = new TracingService(new LoggingService());
        const writer = new MockTraceWriter();

        const tracer1 = service.getBuilder().build();
        const tracer2 = service.getBuilder().useTraceWriter(writer).build();

        tracer1.startSpan("tracer1").done();
        tracer2.startSpan("tracer2").done();

        expect(writer.start.size).toBe(1);
    }); 
});