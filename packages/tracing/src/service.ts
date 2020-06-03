import { createService, Singleton } from "@shrub/core";
import createId from "@sprig/unique-id";

// The tracing logic was motivated by the Google Dapper paper: 
// https://static.googleusercontent.com/media/research.google.com/en//archive/papers/dapper-2010-1.pdf 

type ErrorLogLevel = 40;
type WarnLogLevel = 30;
type InfoLogLevel = 20;
type DebugLogLevel = 10;

/** Defines the data types for a log. */
export type LogDataType = "error" | "event" | "message";
/** Defines a properties dictionary for log data. */
export type LogDataProps = { readonly [key: string]: string };

/** Represents the data for a log. */
export interface ILogData {
    readonly type: LogDataType;
    readonly props?: LogDataProps;
}

/** Represents log data for an Error object. */
export interface IErrorLogData extends ILogData {
    readonly type: "error";
    readonly name: string;
    readonly message: string;
    readonly stack?: string | undefined;
}

/** Represents log data for an event. */
export interface IEventLogData extends ILogData {
    readonly type: "event";
    readonly name: string;
}

/** Represents log data for a standard string message. */
export interface IMessageLogData extends ILogData {
    readonly type: "message";
    readonly message: string;
}

/** Represents additional information for a span. */
export interface ILog {
    /** 
     * Identifies the severity level for the log; the higher the number the more severe. 
     * There are a few defined severity level ranges:
     * 
     *     error = 4x
     *     warn = 3x
     *     info = 2x
     *     debug = 1x
     */
    readonly level: number;    
    readonly data: ILogData;
    readonly timestamp: number;
}

/** Responsible for creating and writing spans. */
export interface ITracer {
    /** Starts a new span with the given name and tags */
    startSpan(name: string, tags?: ITags): ISpan;     
}

/** Responsible for building a tracer factory function. */
export interface ITracerBuilder {
    /** 
     * Builds a tracer with an optional scope. The scope can be any object containing information for a
     * parent scope. The builder supports custom providers that are responsible for processing
     * the scope and converting it into a span context; by default, a span or span context 
     * object are automatically processed as a scope. 
     * 
     * If a valid scope is provided and contains information for a parent span (e.g. span context) then spans 
     * started from the tracer will be a child of the span associated with the scope.
     */
    build(scope?: any): ITracer;
    /** Registers a span context provider with the builder. */
    useContextProvider(provider: ISpanContextProvider): ITracerBuilder;
    /** Registers a log data converter with the builder. The log data converter handles converting logged data into ILogData objects. */
    useLogDataConverter(converter: ILogDataConverter): ITracerBuilder;
    /** Registers an observer with the builder. */
    useObserver(observer: ITraceObserver): ITracerBuilder; 
}

/** Converts a standard object into a log data json object to be logged with a span. */
export interface ILogDataConverter {
    /** The callback should return a new log data object or undefined if it cannot process the object. */
    (obj: object, context: ILogDataConverterContext): ILogData | undefined;
}

export interface ILogDataConverterContext {
    /** Converts a value to be logged as a string property for a log. */
    toString(value: any): string;
}

/** Responsible for providing a span context for a given trace scope. */
export interface ISpanContextProvider {
    /** Gets a span context for a given scope; returns undefined if the scope is not recognized or a span context does not exist for the scope. */
    getSpanContext(scope: any): ISpanContext | undefined;
}

/** An observer for trace events. */
export interface ITraceObserver {
    /** Occurs when the specified span has started. */
    readonly start?: (scope: any, span: ISpan) => void;
    /** Occurs when a log has been added to a span. */
    readonly log?: (span: ISpan, log: ILog) => void;
    /** Occurs when the specified span is done. */
    readonly done?: (scope: any, span: ISpan) => void;
}

/** A service responsible for creating and providing tracers. */
export interface ITracingService {
    /** Gets a tracer builder used to extend the default tracer. */
    getBuilder(): ITracerBuilder;
    /** Gets a new tracer. */
    getTracer(scope?: any): ITracer;
}

/** A set of key/value pairs for a span. */
export interface ITags { 
    readonly [key: string]: number | string | boolean | undefined;
}

/** Represents a logical unit of work for a trace record. */
export interface ISpan {
    /** A 64 bit identifier for the span. */
    readonly id: string;
    /** An optional parent span id. */
    readonly parentId?: string;
    /** A 128 bit identifier for the trace. */
    readonly traceId: string;
    /** A name for the span. */
    readonly name: string;
    /** The start time for the span represented as the number of milliseconds from epoch. */
    readonly startTime: number;
    /** The end time for the span represented as the number of milliseconds from epoch. */
    readonly endTime?: number;
    /** A set of logs for the span. */
    readonly logs: ILog[];
    /** The set of tags for the span. */
    readonly tags: ITags;
    /** Finalizes the span and accepts an optional Error instance if the span resulted in an error. */
    done(err?: Error): void;
    /** Log additional information with the span. */
    log(level: number, data: any): void;
    /** Log debug data with the span. */
    logDebug(data: any): void;
    /** Log error data with the span. */
    logError(data: any): void;
    /** Log info data with the span. */
    logInfo(data: any): void;
    /** Log warning data with the span. */
    logWarn(data: any): void;    
    /** Adds a tag to the span. */
    tag(key: string, value: any): void;
}

/** Represents the distributed context for an existing span. */
export interface ISpanContext {
    /** Gets the parent span id for the context. */
    getParentSpanId(): string;
    /** Gets the trace id for the context. */
    getTraceId(): string;
}

export const ITracingService = createService<ITracingService>("tracing-service");

/** Defines standard levels for span logs. */
export const LogLevel: { 
    readonly error: ErrorLogLevel;
    readonly warn: WarnLogLevel;
    readonly info: InfoLogLevel;
    readonly debug: DebugLogLevel;
} = {
    error: 40,
    warn: 30,
    info: 20,
    debug: 10
};

const defaultLogDataConverter: ILogDataConverter = (obj, context) => {
    if (isLogData(obj)) {
        return obj;
    }

    if (isError(obj)) {
        return <IErrorLogData>({
            type: "error",
            name: obj.name,
            message: obj.message,
            stack: obj.stack
        });
    }

    const name = (<any>obj).name || "";
    const props: any = {};

    // check if the event object is in the format: { name, data } or { name, props }
    // otherwise use the props for the object as the log data props
    if ((<any>obj).props || (<any>obj).data) {
        const data = (<any>obj).props || (<any>obj).data;
        for(const key of Object.keys(data)) {
            // include null in the condition
            if ((<any>data)[key] != undefined) {
                props[key] = context.toString((<any>data)[key]);
            }
        }
    }
    else {
        for(const key of Object.keys(obj)) {
            // include null in the condition
            if (key !== "name" && (<any>obj)[key] != undefined) {
                props[key] = context.toString((<any>obj)[key]);
            }
        }
    }

    return <IEventLogData>({ type: "event", name, props });
};

function isError(obj: any): obj is Error {
    // instanceof only works if sub-classes extend Error properly (prototype gets set to Error);
    // if the instanceof check fails assume an Error if name, message, and stack are defined.
    return obj instanceof Error || (
        (<Error>obj).name !== undefined &&
        (<Error>obj).message !== undefined &&
        (<Error>obj).stack !== undefined);
}

function isLogData(obj: any): obj is ILogData {
    return obj.type !== undefined;
}

function isSpan(scope: any): scope is ISpan {
    return (<ISpan>scope).id !== undefined && (<ISpan>scope).traceId !== undefined; 
}

function isSpanContext(scope: any): scope is ISpanContext {
    return (<ISpanContext>scope).getTraceId !== undefined && (<ISpanContext>scope).getParentSpanId !== undefined; 
}

function getSpanContext(span: ISpan): ISpanContext {
    return {
        getParentSpanId: () => span.id,
        getTraceId: () => span.traceId
    }
}

function newSpanId(): string {
    return createId(16);
}

function newTraceId(): string {
    return createId();
}

@Singleton
export class TracingService implements ITracingService {
    private readonly providers: ISpanContextProvider[] = [];
    private readonly converters: ILogDataConverter[] = [];
    private readonly observers: ITraceObserver[] = [];
    private defaultBuilder = new TracerBuilder(this.providers, this.converters, this.observers);

    getBuilder(): ITracerBuilder {
        // the builder is immutable so pass new arrays for the global items
        return new TracerBuilder(
            [...this.providers], 
            [...this.converters], 
            [...this.observers]);
    }

    getTracer(scope?: any): ITracer {
        return this.defaultBuilder.build(scope);
    }

    useContextProvider(provider: ISpanContextProvider): void {
        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
        }
    }
    
    useLogDataConverter(converter: ILogDataConverter): void {
        if (!this.converters.includes(converter)) {
            this.converters.push(converter);
        }
    }

    useObserver(observer: ITraceObserver): void {
        if (!this.observers.includes(observer)) {
            this.observers.push(observer);
        }
    }     
}

class TracerBuilder implements ITracerBuilder {
    constructor(
        private readonly providers: ISpanContextProvider[] = [],
        private readonly converters: ILogDataConverter[] = [],
        private readonly observers: ITraceObserver[] = []) {
    }


    /** Builds a tracer for the given scope. */
    build(scope?: any): ITracer {
        const convertLogData: (obj: any) => ILogData = obj => {
            const context = { 
                toString: (value: any) => typeof value === "object" ? JSON.stringify(value) : value.toString()
            };

            for (const converter of this.converters) {
                const data = converter(obj, context);

                if (data) {
                    return data;
                }
            }

            return defaultLogDataConverter(obj, context)!;
        };

        return {
            startSpan: (name, tags) => {
                let context = scope && isSpanContext(scope)
                // the scope is a span-context so pass that down
                ? scope
                : scope && isSpan(scope)
                    // the scope is a span so get a span-context for the span and pass that down
                    ? getSpanContext(scope) 
                    : undefined;
    
                if (!context) {
                    for (const provider of this.providers) {
                        context = provider.getSpanContext(scope);
                        if (context) {
                            break;
                        }
                    }
                }

                const observers = this.observers;
                const span: ISpan = {
                    id: newSpanId(),
                    parentId: context && context.getParentSpanId(),
                    traceId: (context && context.getTraceId()) || newTraceId(),
                    name,
                    startTime: Date.now(),
                    logs: [],
                    tags: tags || {},
                    done: function(err?: Error) {
                        if (!this.endTime) {
                            if (err) {
                                this.logError(err);
                            }
                    
                            (<any>this).endTime = Date.now();
            
                            observers.forEach(observer => {
                                if (observer.done) {
                                    observer.done(scope, this);
                                }
                            });
                        }
                    },
                    log: function (level, data) {
                        if (typeof level !== "number") {
                            throw new Error(`Invalid level (${level}), must be a number.`);
                        }

                        if (level >= LogLevel.error) {
                            // automatically tag the span as an error if an error has been logged
                            this.tag("error", true);
                        }
            
                        const log = {
                            level,
                            data: typeof data !== "object" 
                                ? <ILogData>({ type: "message", message: data.toString() })
                                : isLogData(data) ? data : convertLogData(data),
                            timestamp: Date.now()
                        };
            
                        this.logs.push(log);
            
                        observers.forEach(observer => {
                            if (observer.log) {
                                observer.log(this, log);
                            }
                        });
            
                        return log;
                    },
                    logDebug: function (data) {
                        this.log(LogLevel.debug, data);
                    },
                    logError: function (data) {
                        this.log(LogLevel.error, data);
                    },
                    logInfo: function (data) {
                        this.log(LogLevel.info, data);
                    },
                    logWarn: function (data) {
                        this.log(LogLevel.warn, data);
                    },        
                    tag: function (key: string, value: any) {
                        (<any>this.tags)[key] = value;
                    }
                };
            
                observers.forEach(observer => {
                    if (observer.start) {
                        observer.start(scope, span);
                    }
                });
            
                return span;
            }
        };
    }

    /** Registers a span context provider with the builder. */
    useContextProvider(provider: ISpanContextProvider): ITracerBuilder {
        return new TracerBuilder(
            [...this.providers, provider],
            this.converters,
            this.observers);
    }

    /** Registers a log data converter with the builder. The log data converter handles converting logged data into ILogData objects. */
    useLogDataConverter(converter: ILogDataConverter): ITracerBuilder {
        
    
        return new TracerBuilder(
            this.providers,
            [...this.converters, converter],
            this.observers);
    }

    /** Registers an observer with the builder. */
    useObserver(observer: ITraceObserver): ITracerBuilder {
        return new TracerBuilder(
            this.providers,
            this.converters,
            [...this.observers, observer]);
    }
}