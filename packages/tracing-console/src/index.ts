import chalk from "chalk";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILog, ISpan, ITracingConfiguration, LogLevel, TracingModule } from "@shrub/tracing";

export const ITracingConsoleConfiguration = createConfig<ITracingConsoleConfiguration>();
export interface ITracingConsoleConfiguration {
    /** Adds a set of callbacks that define what should or should not be printed to the console; by default, everything gets printed. */
    addFilter(filter: IConsoleTraceFilter): void;
}

/** Options defining what to print to the console; by default all spans and logs are printed. */
export interface IConsoleTraceFilter {
    readonly printStart?: (span: ISpan) => boolean;
    readonly printEnd?: (span: ISpan) => boolean;
    readonly printLog?: (log: ILog) => boolean;
}

export class TracingConsoleModule implements IModule {
    private filter?: IConsoleTraceFilter;

    readonly name = "tracing-console";
    readonly dependencies = [TracingModule];

    initialize(init: IModuleInitializer): void {
        init.config(ITracingConsoleConfiguration).register(() => ({
            addFilter: filter => {
                const base = this.filter;
                this.filter = !base ? filter : {
                    ...base,
                    printStart: span => {
                        if (base.printStart && !base.printStart(span)) {
                            return false;
                        }

                        if (filter.printStart && !filter.printStart(span)) {
                            return false;
                        }

                        return true;
                    },
                    printEnd: span => {
                        if (base.printEnd && !base.printEnd(span)) {
                            return false;
                        }

                        if (filter.printEnd && !filter.printEnd(span)) {
                            return false;
                        }

                        return true;
                    },
                    printLog: log => {
                        if (base.printLog && !base.printLog(log)) {
                            return false;
                        }

                        if (filter.printLog && !filter.printLog(log)) {
                            return false;
                        }

                        return true;
                    }
                };
            }
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(ITracingConfiguration).useObserver({
            start: (scope, span) => printStart(span, this.filter),
            log: (span, log) => printLog(log, this.filter),
            done: (scope, span) => printDone(span, this.filter)
        });
    }
}

function printStart(span: ISpan, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printStart || filter.printStart(span)) {
        if (span.parentId) {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${span.traceId} parent-id=${span.parentId} time=${span.startTime}`));
        }
        else {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${span.traceId} time=${span.startTime}`));
        }
    }
}

function printLog(log: ILog, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printLog || filter.printLog(log)) {
        if (log.level < LogLevel.info) {
            console.log(chalk.magenta("[debug]:"), log.data);
        }
        else if (log.level < LogLevel.warn) {
            console.log(chalk.white("[info]:"), log.data);
        }
        else if (log.level < LogLevel.error) {
            console.log(chalk.yellow("[warn]:"), log.data);
        }
        else {
            console.log(chalk.bgRed("[error]:"), log.data);
        }
    }
}

function printDone(span: ISpan, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printEnd || filter.printEnd(span)) {
        const text = `[end]: name=${span.name} id=${span.id} time=${span.endTime} tags=${JSON.stringify(span.tags)}`; 
        console.log(span.tags.error ? chalk.red(text) : chalk.cyan(text));
    }
}