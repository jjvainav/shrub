import { createService, Singleton } from "@shrub/core";
import createId from "@sprig/unique-id";

// The tracing logic was motivated by the Google Dapper paper: 
// https://static.googleusercontent.com/media/research.google.com/en//archive/papers/dapper-2010-1.pdf 

type ErrorLogLevel = 40;
type WarnLogLevel = 30;
type InfoLogLevel = 20;
type DebugLogLevel = 10;

/** Represents the data for a log. */
export interface ILogData {
    readonly [key: string]: any;
}

export interface IErrorLogData extends ILogData {
    readonly name: string;
    readonly message: string;
    readonly stack: string | undefined;
}

/** Represents additional log information for a span. */
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
    /** 
     * Registers a serializer with the builder. A serializer gets invoked for every json object logged
     * so it is the responsibility of the serializer to check the object type and handle when necessary
     * and simply return the provided log data object if the serializer wants to skip handling the object.
     */
    useSerializer(serializer: ISerializer): ITracerBuilder;
    /** Registers an observer with the builder. */
    useObserver(observer: ITraceObserver): ITracerBuilder; 
}

/** 
 * Serializes a json object into a log data object to be logged with a span.
 * 
 * The obj parameter is the original json object passed to the span and the
 * data parameter is the current object to be logged. By default the properties
 * from the obj are copied to the log data object.
 *  
 * The tracing service chains multiple serializers and the serialize parameter is
 * a reference to the root/head of the chain. This is useful if a serializer
 * wants to explicitly serializer the object's children.
 * 
 *     return {
 *         ...data,
 *         inner: serialize(obj.object)
 *     };
 */
export interface ISerializer {
    (obj: any, data: ILogData, serialize: IChildSerializer): ILogData;
}

/** A serializer used to serialize children of an object being logged. */
export interface IChildSerializer {
    (child: any): any;
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
    log(level: number, data: any): ILog;
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

interface ICreateSpanOptions {
    /** Represents a parent span in which the new span will be created as a child of.  */
    readonly context?: ISpanContext;
    /** An optional serializer used to serialize json objects to log data objects. */
    readonly serializer?: ISerializer;
    /** An optional set of tags for the span. */
    readonly tags?: ITags;
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

const baseSerializer: ISerializer = (obj, _, serialize) => {
    // the base serializer is expected to be invoked first with an empty log data object so ignore it

    if (isError(obj)) {
        return {
            name: obj.name,
            message: obj.message,
            stack: obj.stack
        };
    }

    if (Array.isArray(obj)) {
        // TODO: is this the best way to handle array?
        let data = {};
        for (let i = 0; i < obj.length; i++) {
            data = { 
                ...data,
                [`${i}`]: serialize(obj[i])
            };
        }

        return data;
    }

    // object.keys would be the same behavior as the spread operator (e.g. { ...obj })
    // which Typescript compiles to Object.assign({}, obj)

    let data: any = {};
    for(const key of Object.keys(obj)) {
        data[key] = typeof obj[key] === "object" ? serialize(obj[key]) : obj[key];
    }

    return data;
};

function createSpan(name: string, options?: ICreateSpanOptions): ISpan {
    const context = options && options.context;
    // note: if a custom serializer is used the base serializer is automatically injected
    // so there is no need to worry about that here; use it if no serializer has been specified
    const serializer = (options && options.serializer) || baseSerializer;

    return {
        id: newSpanId(),
        parentId: context && context.getParentSpanId(),
        traceId: (context && context.getTraceId()) || newTraceId(),
        name,
        startTime: Date.now(),
        logs: [],
        tags: options && options.tags || {},
        done: function(err?: Error) {
            if (!this.endTime) {
                if (err) {
                    this.logError(err);
                }
        
                (<any>this).endTime = Date.now();
            }
        },
        log: function(level, data) {
            if (typeof level !== "number") {
                throw new Error(`Invalid level (${level}), must be a number.`);
            }

            if (level >= LogLevel.error) {
                // automatically tag the span as an error if an error has been logged
                this.tag("error", true);
            }

            if (typeof data === "object") {
                const childSerializer: IChildSerializer = child => serializer(child, {}, childSerializer);
                data = serializer(data, {}, childSerializer);
            }

            const log = {
                level,
                data,
                timestamp: Date.now()
            };

            this.logs.push(log);

            return log;
        },
        logDebug: function(data) {
            this.log(LogLevel.debug, data);
        },
        logError: function(data) {
            this.log(LogLevel.error, data);
        },
        logInfo: function(data) {
            this.log(LogLevel.info, data);
        },
        logWarn: function(data) {
            this.log(LogLevel.warn, data);
        },        
        tag: function(key: string, value: any) {
            (<any>this.tags)[key] = value;
        }
    };
}

function isError(obj: any): obj is Error {
    // instanceof only works if sub-classes extend Error properly (prototype gets set to Error);
    // if the instanceof check fails assume an Error if name, message, and stack are defined.
    return obj instanceof Error || (
        (<Error>obj).name !== undefined &&
        (<Error>obj).message !== undefined &&
        (<Error>obj).stack !== undefined);
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
    // 64 bit
    return createId(8);
}

function newTraceId(): string {
    // 128 bit
    return createId(16);
}

@Singleton
export class TracingService implements ITracingService {
    private readonly providers: ISpanContextProvider[] = [];
    private readonly serializers: ISerializer[] = [];
    private readonly observers: ITraceObserver[] = [];
    private defaultBuilder = new TracerBuilder(this.providers, this.serializers, this.observers);

    getBuilder(): ITracerBuilder {
        // the builder is immutable so pass new arrays for the global items
        return new TracerBuilder(
            [...this.providers], 
            [...this.serializers], 
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
    
    useSerializer(serializer: ISerializer): void {
        if (!this.serializers.includes(serializer)) {
            this.serializers.push(serializer);
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
        private readonly serializers: ISerializer[] = [],
        private readonly observers: ITraceObserver[] = []) {
    }

    /** Builds a tracer for the given scope. */
    build(scope?: any): ITracer {
        let serializer = baseSerializer;
        this.serializers.forEach(s => {
            const current = serializer;
            serializer = (obj, data, serialize) => s(obj, current(obj, data, serialize), serialize);
        });

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

                let span = createSpan(name, { context, serializer, tags });
                if (this.observers.length) {
                    const me = this;
                    const base = span;
                    span = {
                        ...span,
                        log: function(level, data) {
                            const result = base.log.call(this, level, data);
                            me.observers.forEach(observer => {
                                if (observer.log) {
                                    observer.log(this, result);
                                }
                            });
       
                            return result;
                        },                            
                        done: function(err?) {
                            base.done.call(this, err);
                            me.observers.forEach(observer => {
                                if (observer.done) {
                                    observer.done(scope, this);
                                }
                            });
                        }
                    };
    
                    this.observers.forEach(observer => {
                        if (observer.start) {
                            observer.start(scope, span);
                        }
                    });                    
                }

                return span;
            }
        };
    }

    /** Registers a span context provider with the builder. */
    useContextProvider(provider: ISpanContextProvider): ITracerBuilder {
        return new TracerBuilder(
            [...this.providers, provider],
            this.serializers,
            this.observers);
    }

    /** 
     * Registers a serializer with the builder. A serializer gets invoked for every json object logged
     * so it is the responsibility of the serializer to check the object type and handle when necessary
     * and simply return the provided log data object if the serializer wants to skip handling the object.
     */
    useSerializer(serializer: ISerializer): ITracerBuilder {
        return new TracerBuilder(
            this.providers,
            [...this.serializers, serializer],
            this.observers);
    }

    /** Registers an observer with the builder. */
    useObserver(observer: ITraceObserver): ITracerBuilder {
        return new TracerBuilder(
            this.providers,
            this.serializers,
            [...this.observers, observer]);
    }
}