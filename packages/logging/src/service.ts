import { createInjectable, createService, Singleton } from "@shrub/core";

type ErrorLogLevel = 40;
type WarnLogLevel = 30;
type InfoLogLevel = 20;
type DebugLogLevel = 10;

/** Defines the type of data that can be passed to a logger. */
export type LogDataArg = ILogEvent | Error | string;
/** Defines the type of data that can be saved with a log entry. */
export type LogData = ILogEvent | string;

/** Represents the data for a logged event. */
export interface ILogEvent {
    /** A name for the event. */
    readonly name: string;
    /** Properties for the event. */
    readonly [key: string]: string | number | boolean | undefined;
}

/** Converts log data args to a log data object that will be saved with a log entry. */
export interface ILogDataConverter {
    /** The callback should return log data or undefined to skip handling the arguments. */
    (arg: LogDataArg): LogData | undefined;
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
    readonly data: LogData;
    /** The timestamp (in milliseconds) for when the log was created. */
    readonly timestamp: number;
}

/** Handles writing log entries. */
export interface ILogWriter {
    writeLog(entry: ILogEntry): void;
}

/** Handles log data. */
export interface ILogger {
    /** Creates a log entry with the specified log level. */
    log(level: number, data: LogDataArg): void;
    /** Creates a debug log entry. */
    logDebug(data: LogDataArg): void;
    /** Creates an error log entry. */
    logError(data: LogDataArg): void;
    /** Creates an info log entry. */
    logInfo(data: LogDataArg): void;
    /** Creates a warning log entry. */
    logWarn(data: LogDataArg): void;
}

/** Options for creating named loggers. */
export interface ILoggerOptions {
    /** If defined, a set of log data converters to use instead of the global converters. */
    readonly converters?: ILogDataConverter[];
    /** If defined, a set of writers to use instead of the global writers. */
    readonly writers?: ILogWriter[];
}

/** Log service responsible for creating loggers. */
export interface ILoggingService {
    /** Creates a logger instance using the specified options or use the globally registered data converters and writers. */
    createLogger(options?: ILoggerOptions): ILogger;
    /** Registers a log data converter that will be available to loggers created by the service. */
    useConverter(converter: ILogDataConverter): void;
    /** Registers a log writer with the service. */
    useWriter(writer: ILogWriter): void;
}

export const ILoggingService = createService<ILoggingService>("logging-service");

/** A decorator for injecting a global logger. */
export const ILogger = createInjectable<ILogger>({
    key: "logger",
    factory: services => services.get(ILoggingService).createLogger()
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

const defaultLogDataConverter: (arg: LogDataArg) => LogData = arg => !isError(arg) ? arg : {
    name: arg.name,
    message: arg.message,
    stack: arg.stack
};

function isError(obj: any): obj is Error {
    // instanceof only works if sub-classes extend Error properly (prototype gets set to Error);
    // if the instanceof check fails assume an Error if name, message, and stack are defined.
    return obj instanceof Error || (
        (<Error>obj).name !== undefined &&
        (<Error>obj).message !== undefined &&
        (<Error>obj).stack !== undefined);
}

@Singleton
export class LoggingService implements ILoggingService {
    private readonly converters: ILogDataConverter[] = [];
    private readonly writers: ILogWriter[] = [];

    createLogger(options: ILoggerOptions): ILogger {
        const global = this;
        return new class Logger implements ILogger {
            private readonly converters: ILogDataConverter[];
            private readonly writers: ILogWriter[];

            constructor() {
                this.converters = options && options.converters || global.converters;
                this.writers = options && options.writers || global.writers;
            }

            log(level: number, data: LogDataArg): void {
                if (typeof level !== "number") {
                    throw new Error(`Invalid level (${level}), must be a number.`);
                }
        
                const entry: ILogEntry = {
                    level,
                    data: this.convertLogDataArg(data),
                    timestamp: Date.now()
                };
        
                this.write(entry);
            }
        
            logDebug(data: LogDataArg): void {
                this.log(LogLevel.debug, data);
            }
        
            logError(data: LogDataArg): void {
                this.log(LogLevel.error, data);
            }
        
            logInfo(data: LogDataArg): void {
                this.log(LogLevel.info, data);
            }
        
            logWarn(data: LogDataArg): void {
                this.log(LogLevel.warn, data);
            }
        
            private write(entry: ILogEntry): void {
                this.writers.forEach(writer => writer.writeLog(entry));
            }
        
            private convertLogDataArg(arg: LogDataArg): LogData {
                for (const converter of this.converters) {
                    const data = converter(arg);
                    if (data) {
                        return data;
                    }
                }

                return defaultLogDataConverter(arg);
            };
        };
    }

    useConverter(converter: ILogDataConverter): void {
        this.converters.push(converter);
    }

    useWriter(writer: ILogWriter): void {
        this.writers.push(writer);
    }
}