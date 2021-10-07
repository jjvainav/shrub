import { createService, Scoped, Singleton } from "@shrub/core";
import { ILogEntry, ILogger, ILoggingService, LogLevel } from "@shrub/logging";
import createId from "@sprig/unique-id";

// The tracing logic was motivated by the Google Dapper paper: 
// https://static.googleusercontent.com/media/research.google.com/en//archive/papers/dapper-2010-1.pdf 

/** Value type for a tag. */
export type TagValue = number | string | boolean;

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
    /** Registers a trace writer with the builder. */
    useTraceWriter(writer: ITraceWriter): ITracerBuilder; 
}

/** Responsible for providing a span context for a given trace scope. */
export interface ISpanContextProvider {
    /** Gets a span context for a given scope; returns undefined if the scope is not recognized or a span context does not exist for the scope. */
    getSpanContext(scope: any): ISpanContext | undefined;
}

/** Handles writing trace information. */
export interface ITraceWriter {
    /** Writes the start event for the specified span. */
    writeStart(span: ISpan): void;
    /** Writes a log entry for the specified span. */
    writeLog(span: ISpan, log: ILogEntry): void;
    /** Writes a tag for the specified span. */
    writeTag(span: ISpan, key: string, value: TagValue): void;
    /** Writes the done event for the specified span. */
    writeDone(span: ISpan): void;
}

/** A service responsible for creating and providing tracers. */
export interface ITracingService {
    /** Gets a tracer builder used to extend the default tracer. */
    getBuilder(): ITracerBuilder;
    /** Gets a new tracer. */
    getTracer(scope?: any): ITracer;
}

/** @internal */
export interface ITracingRegistrationService {
    getContextProviders(): ISpanContextProvider[];
    getTraceWriters(): ITraceWriter[];

    useContextProvider(provider: ISpanContextProvider): void;
    useTraceWriter(writer: ITraceWriter): void;
}

/** A set of key/value pairs for a span. */
export interface ITags { 
    readonly [key: string]: TagValue | undefined;
}

/** Represents a logical unit of work for a trace record. */
export interface ISpan extends ILogger {
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
    /** Finalizes the span and accepts an optional Error instance if the span resulted in an error. */
    done(err?: Error): void;   
    /** Adds a tag to the span. */
    tag(key: string, value: TagValue): void;
}

/** Represents the distributed context for an existing span. */
export interface ISpanContext {
    /** Gets the parent span id for the context. */
    getParentSpanId(): string;
    /** Gets the trace id for the context. */
    getTraceId(): string;
}

export const ITracingService = createService<ITracingService>("tracing-service");
/** @internal */
export const ITracingRegistrationService = createService<ITracingRegistrationService>("tracing-registration-service");

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

/** @internal */
@Scoped
export class TracingService implements ITracingService {
    private readonly defaultBuilder: TracerBuilder;

    constructor(
        @ITracingRegistrationService private readonly registrationService: ITracingRegistrationService,
        @ILoggingService private readonly loggingService: ILoggingService) {
        this.defaultBuilder = new TracerBuilder(loggingService, this.registrationService.getContextProviders(), this.registrationService.getTraceWriters());
    }

    getBuilder(): ITracerBuilder {
        // the builder is immutable so pass new arrays for the global items
        return new TracerBuilder(
            this.loggingService,
            [...this.registrationService.getContextProviders()], 
            [...this.registrationService.getTraceWriters()]);
    }

    getTracer(scope?: any): ITracer {
        return this.defaultBuilder.build(scope);
    }   
}

/** @internal */
@Singleton
export class TracingRegistrationService implements ITracingRegistrationService {
    private readonly providers: ISpanContextProvider[] = [];
    private readonly writers: ITraceWriter[] = [];

    getContextProviders(): ISpanContextProvider[] {
        return this.providers;
    }

    getTraceWriters(): ITraceWriter[] {
        return this.writers;
    }

    useContextProvider(provider: ISpanContextProvider): void {
        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
        }
    }
    
    useTraceWriter(writer: ITraceWriter): void {
        if (!this.writers.includes(writer)) {
            this.writers.push(writer);
        }
    }  
}

class TracerBuilder implements ITracerBuilder {
    constructor(
        private readonly loggingService: ILoggingService,
        private readonly providers: ISpanContextProvider[] = [],
        private readonly writers: ITraceWriter[] = []) {
    }

    /** Builds a tracer for the given scope. */
    build(scope?: any): ITracer {
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

                // create a logger to use with the span
                const logger = this.loggingService.createLogger({
                    writers: this.writers.map(writer => ({
                        writeLog: entry => writer.writeLog(span, entry)
                    }))
                });

                const writers = this.writers;
                const span: ISpan = {
                    id: newSpanId(),
                    parentId: context && context.getParentSpanId(),
                    traceId: (context && context.getTraceId()) || newTraceId(),
                    name,
                    startTime: Date.now(),
                    done: function(err?: Error) {
                        if (!this.endTime) {
                            if (err) {
                                this.logError(err);
                            }
                    
                            (<any>this).endTime = Date.now();
                            writers.forEach(writer => writer.writeDone(this));
                        }
                    },
                    log: function (level, data) {
                        if (level >= LogLevel.error) {
                            // automatically tag the span as an error if an error has been logged
                            this.tag("error", true);
                        }
            
                        // the logger will invoke writers so we don't have to worry about that here
                        logger.log(level, data);
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
                        writers.forEach(writer => writer.writeTag(this, key, value));
                    }
                };

                writers.forEach(writer => writer.writeStart(span));

                if (tags) {
                    for (const key of Object.keys(tags)) {
                        if (tags[key] !== undefined) {
                            span.tag(key, tags[key]!);
                        }
                    }
                }
            
                return span;
            }
        };
    }

    /** Registers a span context provider with the builder. */
    useContextProvider(provider: ISpanContextProvider): ITracerBuilder {
        return new TracerBuilder(
            this.loggingService,
            [...this.providers, provider],
            this.writers);
    }

    /** Registers a trace writer with the builder. */
    useTraceWriter(writer: ITraceWriter): ITracerBuilder {
        return new TracerBuilder(
            this.loggingService,
            this.providers,
            [...this.writers, writer]);
    }
}