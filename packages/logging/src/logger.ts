import { createInjectable, createService, Singleton } from "@shrub/core";

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

/** Converts a standard object into a log data json object to be saved with a log entry. */
export interface ILogDataConverter {
    /** The callback should return a new log data object or undefined if it cannot process the object. */
    (obj: object, context: ILogDataConverterContext): ILogData | undefined;
}

export interface ILogDataConverterContext {
    /** Converts a value to be logged as a string property for a log. */
    toString(value: any): string;
}

/** Represents an entry in a log. */
export interface ILogEntry {
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
    /** Data saved with the log entry. */ 
    readonly data: ILogData;
    /** The timestamp (in milliseconds) for when the log was created. */
    readonly timestamp: number;
}

/** Responsible for writing a log entry. */
export interface ILogEntryWritter {
    (entry: ILogEntry): void;
}

/** Handles log data. */
export interface ILogger {
    /** Creates a log entry with the specified log level. */
    log(level: number, data: any): void;
    /** Creates a debug log entry. */
    logDebug(data: any): void;
    /** Creates an error log entry. */
    logError(data: any): void;
    /** Creates an info log entry. */
    logInfo(data: any): void;
    /** Creates a warning log entry. */
    logWarn(data: any): void;
}

/** Options for creating a logger used to override the globally registered options for a logger. */
export interface ILoggerOptions {
    /** If defined, a set of converters to use instead of the global converters. */
    readonly converters?: ILogDataConverter[];
    /** If defined, a set of writers to use instead of the global writers. */
    readonly writers?: ILogEntryWritter[];
}

/** Log service responsible for creating loggers. */
export interface ILogService {
    /** Creates a logger instance using the specified options or use the globally registered data converters and writers. */
    createLogger(options?: ILoggerOptions): ILogger;
    /** Registers a log data converter that will be available to loggers created by the service. */
    registerLogDataConverter(converter: ILogDataConverter): void;
    /** Registers a log entry writer with the service. */
    registerLogEntryWritter(writer: ILogEntryWritter): void;
}

export const ILogService = createService<ILogService>("log-service");

/** A decorator for injecting a global logger. */
export const ILogger = createInjectable<ILogger>({
    key: "logger",
    factory: services => services.get(ILogService).createLogger()
});

/** Defines standard levels for log entries. */
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

/** Default log data converter used by the base logger. */
export const defaultLogDataConverter: ILogDataConverter = (obj, context) => {
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

/** @internal */
@Singleton
export class LogService implements ILogService {
    private readonly converters: ILogDataConverter[] = [];
    private readonly writers: ILogEntryWritter[] = [];

    /** Creates a logger instance using the specified options or use the globally registered data converters and writers. */
    createLogger(options?: ILoggerOptions): ILogger {
        const global = this;
        return new class Logger implements ILogger {
            private readonly converters: ILogDataConverter[];
            private readonly writers: ILogEntryWritter[];

            constructor() {
                this.converters = options && options.converters || global.converters;
                this.writers = options && options.writers || global.writers;
            }

            /** Creates a log entry with the specified log level. */
            log(level: number, data: any): void {
                // TODO: tracing will extend logging -- ISpan will extend logger
                // TODO: change messaging to enableLogging instead of enableTracing
        
                if (typeof level !== "number") {
                    throw new Error(`Invalid level (${level}), must be a number.`);
                }
        
                const entry: ILogEntry = {
                    level,
                    data: typeof data !== "object" 
                        ? <ILogData>({ type: "message", message: data.toString() })
                        : isLogData(data) ? data : this.convertLogData(data),
                    timestamp: Date.now()
                };
        
                this.write(entry);
            }
        
            /** Creates a debug log entry. */
            logDebug(data: any): void {
                this.log(LogLevel.debug, data);
            }
        
            /** Creates an error log entry. */
            logError(data: any): void {
                this.log(LogLevel.error, data);
            }
        
            /** Creates an info log entry. */
            logInfo(data: any): void {
                this.log(LogLevel.info, data);
            }
        
            /** Creates a warning log entry. */
            logWarn(data: any): void {
                this.log(LogLevel.warn, data);
            }
        
            private write(entry: ILogEntry): void {
                this.writers.forEach(writer => writer(entry));
            }
        
            private convertLogData(obj: any): ILogData {
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
        };
    }

    /** Registers a log data converter that will be available to loggers created by the service. */
    registerLogDataConverter(converter: ILogDataConverter): void {
        this.converters.push(converter);
    }

    /** Registers a log entry writer with the service. */
    registerLogEntryWritter(writer: ILogEntryWritter): void {
        this.writers.push(writer);
    }
}