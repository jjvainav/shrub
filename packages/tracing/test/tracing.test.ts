import { IErrorLogData, IEventLogData, ILog, IMessageLogData, ISpan, TracingService } from "../src";

function mockDateNow(now: number): () => void {
    const nowfn = Date.now;
    Date.now = jest.fn(() => now);
    return () => Date.now = nowfn;
}

describe("tracing", () => {
    test("create root span", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        unmock();

        expect(span.id).toHaveLength(8);
        expect(span.traceId).toHaveLength(16);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(now);
        expect(span.endTime).toBeUndefined();
        expect(span.logs).toHaveLength(0);
        expect(Object.keys(span.tags)).toHaveLength(0);
    });

    test("create root span with tags", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test", { tag: "foo" });

        unmock();

        expect(span.id).toHaveLength(8);
        expect(span.traceId).toHaveLength(16);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(now);
        expect(span.endTime).toBeUndefined();
        expect(span.logs).toHaveLength(0);
        expect(span.tags.tag).toBe("foo");
    });

    test("create and finish root span", () => {
        const start = 1562602719878;
        const unmockStart = mockDateNow(start);

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        unmockStart();

        const end = start + 1000;
        const unmockEnd = mockDateNow(end);

        span.done();

        unmockEnd();

        expect(span.id).toHaveLength(8);
        expect(span.traceId).toHaveLength(16);
        expect(span.parentId).toBeUndefined();
        expect(span.name).toBe("test");
        expect(span.startTime).toBe(start);
        expect(span.endTime).toBe(end);
        expect(span.logs).toHaveLength(0);
        expect(Object.keys(span.tags)).toHaveLength(0);
    });

    test("create and finish root span with error", () => {
        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");
        const err = new Error("An error occurred.");

        span.done(err);

        // make sure the end time is still getting set
        expect(span.endTime).toBeDefined();
        
        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].data.type).toBe("error");
        expect((<IErrorLogData>span.logs[0].data).name).toBe("Error");
        expect((<IErrorLogData>span.logs[0].data).message).toBe("An error occurred.");
        expect((<IErrorLogData>span.logs[0].data).stack).toBeDefined();
        
        expect(Object.keys(span.tags)).toHaveLength(1);
        expect(span.tags.error).toBe(true);
    });
    
    test("create and finish root span with error using custom converter", () => {
        const service = new TracingService();

        // the converter needs to be injected before getting a tracer and creating a span
        service.useLogDataConverter(obj => {
            if (obj instanceof Error) {
                return <IErrorLogData>({
                    type: "error",
                    name: "FooError",
                    message: obj.message,
                    props: { foo: "foo" },
                    stack: obj.stack
                });
            }

            return undefined;
        });

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");
        const err = new Error("An error occurred.");

        span.done(err);

        expect(span.logs).toHaveLength(1);
        expect((<IErrorLogData>span.logs[0].data).name).toBe("FooError");
        expect((<IErrorLogData>span.logs[0].data).message).toBe("An error occurred.");
        expect((<IErrorLogData>span.logs[0].data).stack).toBeDefined();
        expect((<IErrorLogData>span.logs[0].data).props!.foo).toBe("foo");
    });  

    test("create multiple root spans", () => {
        const service = new TracingService();
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
        const service = new TracingService();

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
        const service = new TracingService();
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

    test("create root and child spans with start/done observer", () => {
        const service = new TracingService();
        const start: [any, ISpan][] = [];
        const done: [any, ISpan][] = [];

        service.useObserver({
            start: (scope, span) => start.push([scope, span]),
            done: (scope, span) => done.push([scope, span])
        });

        const scope = {};
        const root = service.getTracer(scope).startSpan("root");
        const child = service.getTracer(root).startSpan("child");

        child.done();
        root.done();

        expect(start.length).toBe(2);
        expect(start[0][0]).toBe(scope);
        expect(start[0][1]).toBe(root);
        expect(start[1][0]).toBe(root);
        expect(start[1][1]).toBe(child);

        // note: these will be in reverse from the start items since the child is expected to be done before the root
        expect(done.length).toBe(2);
        expect(done[0][0]).toBe(root);
        expect(done[0][1]).toBe(child); 
        expect(done[1][0]).toBe(scope);
        expect(done[1][1]).toBe(root);
    }); 
    
    test("create span with context provider that doesn't recognize scope", () => {
        const service = new TracingService();

        service.useContextProvider({
            getSpanContext: () => undefined
        });

        const root = service.getTracer().startSpan("root");

        expect(root.id).toBeDefined();
        expect(root.traceId).toBeDefined();
        expect(root.parentId).toBeUndefined();
    });

    test("create span with multiple context providers", () => {
        const service = new TracingService();

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

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ 
            name: "foo-event",
            foo: "foo" 
        });

        unmock();

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IEventLogData>span.logs[0].data).type).toBe("event");
        expect((<IEventLogData>span.logs[0].data).name).toBe("foo-event");
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
        expect(span.logs[0].timestamp).toBe(now);
    });

    test("add event object info log to span with custom data prop", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ 
            name: "foo-event",
            data: {
                foo: "foo"
            } 
        });

        unmock();

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IEventLogData>span.logs[0].data).type).toBe("event");
        expect((<IEventLogData>span.logs[0].data).name).toBe("foo-event");
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
        expect(span.logs[0].timestamp).toBe(now);
    });

    test("add plain JSON object info log to span", () => {
        const now = 1562602719878;
        const unmock = mockDateNow(now);

        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ foo: "foo" });

        unmock();

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IEventLogData>span.logs[0].data).type).toBe("event");
        expect((<IEventLogData>span.logs[0].data).name).toBe("");
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
        expect(span.logs[0].timestamp).toBe(now);
    });

    test("add plain JSON object info log to span with log observer", () => {
        const service = new TracingService();
        const logs: [ISpan, ILog][] = [];

        service.useObserver({
            log: (span, log) => logs.push([span, log])
        });

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ foo: "foo" });
        span.logInfo({ bar: "bar" });

        expect(logs).toHaveLength(2);
        expect(logs[0][0]).toBe(span);
        expect((<IEventLogData>logs[0][1].data).props!.foo).toBe("foo");
        expect(logs[1][0]).toBe(span);
        expect((<IEventLogData>logs[1][1].data).props!.bar).toBe("bar");
    });    

    test("add plain JSON object info log to span with custom log data converter", () => {
        const service = new TracingService();

        // the converter needs to be injected before getting a tracer and creating a span
        service.useLogDataConverter(obj => <IEventLogData>({ 
            type: "event", 
            name: "my-event",
            props: { ...obj, bar: "bar" }
        }));

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ foo: "foo" });

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
        expect((<IEventLogData>span.logs[0].data).props!.bar).toBe("bar");
    });   
    
    test("add info log to span with multiple log data converters", () => {
        const service = new TracingService();

        service.useLogDataConverter(() => undefined);
        service.useLogDataConverter(obj => <IEventLogData>({ 
            type: "event", 
            name: "my-event",
            props: obj
        }));        

        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo({ foo: "foo" });

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IEventLogData>span.logs[0].data).name).toBe("my-event");
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
    });
    
    test("add error log to span", () => {
        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logError(new Error("Error test."));

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(40);
        expect((<IErrorLogData>span.logs[0].data).name).toBe("Error");
        expect((<IErrorLogData>span.logs[0].data).message).toBe("Error test.");
        expect((<IErrorLogData>span.logs[0].data).stack).toBeDefined();

        expect(Object.keys(span.tags)).toHaveLength(1);
        expect(span.tags.error).toBe(true);        
    });

    test("add error log to span for error that does not properly extend the Error class", () => {
        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logError(new class extends Error {
            constructor() {
                super("Foo");
                // by not setting the classes prototype an instanceof Error check will fail
                // https://stackoverflow.com/a/41102306
            }
        });

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(40);
        expect((<IErrorLogData>span.logs[0].data).name).toBe("Error");
        expect((<IErrorLogData>span.logs[0].data).message).toBe("Foo");
        expect((<IErrorLogData>span.logs[0].data).stack).toBeDefined();

        expect(Object.keys(span.tags)).toHaveLength(1);
        expect(span.tags.error).toBe(true);     
    });  

    test("add log to span with custom level", () => {
        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.log(11, { foo: "foo" });

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(11);
        expect((<IEventLogData>span.logs[0].data).props!.foo).toBe("foo");
    });

    test("add log to span with string data", () => {
        const service = new TracingService();
        const tracer = service.getTracer();
        const span = tracer.startSpan("test");

        span.logInfo("foo");

        expect(span.logs).toHaveLength(1);
        expect(span.logs[0].level).toBe(20);
        expect((<IMessageLogData>span.logs[0].data).type).toBe("message");
        expect((<IMessageLogData>span.logs[0].data).message).toBe("foo");
    });  
    
    test("extend tracer with custom builder and observer", () => {
        const service = new TracingService();
        let counter = 0;

        const tracer1 = service.getBuilder().build();
        const tracer2 = service.getBuilder().useObserver({ done: () => counter++ }).build();

        tracer1.startSpan("tracer1").done();
        tracer2.startSpan("tracer2").done();

        expect(counter).toBe(1);
    }); 
});