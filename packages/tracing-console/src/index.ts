import chalk from "chalk";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogEntry, LogLevel } from "@shrub/logging";
import { ISpan, ITracingConfiguration, TagValue, TracingModule } from "@shrub/tracing";

export interface ITracingConsoleConfiguration {
    /** Adds a set of callbacks that define what should or should not be printed to the console; by default, everything gets printed. */
    addFilter(filter: IConsoleTraceFilter): void;
}

/** Options defining what to print to the console; by default all spans and logs are printed. */
export interface IConsoleTraceFilter {
    /** Determines whether or not the specified log information should be printed. */
    readonly printLog?: (span: ISpan, log: ILogEntry) => boolean;
    /** Determines whether or not the specified tag information should be printed. */
    readonly printTag?: (span: ISpan, key: string, value: TagValue) => boolean;
    /** Determines if the specified start/end information for a span should be printed. */
    readonly printSpan?: (span: ISpan) => boolean;
}

interface ISpanInfo {
    readonly isError: boolean;
}

export const ITracingConsoleConfiguration = createConfig<ITracingConsoleConfiguration>();
const colors = [
    "#FAEBD7", "#00FFFF", "#7FFFD4", "#F5F5DC", "#FFEBCD", "#8A2BE2", "#A52A2A", "#DEB887",
    "#5F9EA0", "#7FFF00", "#D2691E", "#6495ED", "#DC143C", "#008B8B", "#A9A9A9", "#006400",
    "#BDB76B", "#8B008B", "#E9967A", "#8FBC8F", "#00CED1", "#FF1493", "#1E90FF", "#DCDCDC",
    "#FFD700", "#ADFF2F", "#CD5C5C", "#F0E68C", "#E6E6FA", "#FFF0F5", "#ADD8E6", "#F08080",
    "#FAFAD2", "#FFB6C1", "#20B2AA", "#87CEFA", "#FAF0E6", "#800000", "#BA55D3", "#C71585",
    "#000080", "#FFA500", "#98FB98", "#BC8F8F", "#A0522D", "#EE82EE", "#9ACD32", "#F5DEB3"
];

const spans = new Map<ISpan, ISpanInfo>();

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
                    printLog: (span, log) => {
                        if (base.printLog && !base.printLog(span, log)) {
                            return false;
                        }

                        if (filter.printLog && !filter.printLog(span, log)) {
                            return false;
                        }

                        return true;
                    },
                    printSpan: span => {
                        if (base.printSpan && !base.printSpan(span)) {
                            return false;
                        }

                        if (filter.printSpan && !filter.printSpan(span)) {
                            return false;
                        }

                        return true;
                    },
                };
            }
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(ITracingConfiguration).useTraceWriter({
            writeStart: (span) => {
                spans.set(span, { isError: false });
                printStart(span, this.filter);
            },
            writeLog: (span, log) => printLog(span, log, this.filter),
            writeTag: (span, key, value) => {
                const info = spans.get(span);
                if (info) {
                    if (key === "error") {
                        spans.set(span, { ...info, isError: true });
                    }

                    printTag(span, key, value, this.filter);
                }
            },
            writeDone: (span) => {
                const info = spans.get(span);
                if (info) {
                    printDone(span, info, this.filter);
                    spans.delete(span);
                }
            }
        });
    }
}

function printStart(span: ISpan, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printSpan || filter.printSpan(span)) {
        if (span.parentId) {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} parent-id=${span.parentId} time=${span.startTime}`));
        }
        else {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} time=${span.startTime}`));
        }
    }
}

function printLog(span: ISpan, log: ILogEntry, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printLog || filter.printLog(span, log)) {
        const getText = (label: string) => `[${label}]: id=${span.id} trace-id=${getColorString(span.traceId)} data=${JSON.stringify(log.data)}`;

        if (log.level < LogLevel.info) {
            console.log(chalk.magenta(getText("debug")));
        }
        else if (log.level < LogLevel.warn) {
            console.log(chalk.green(getText("info")));
        }
        else if (log.level < LogLevel.error) {
            console.log(chalk.yellow(getText("warn")));
        }
        else {
            console.log(chalk.bgRed(getText("error")));
        }
    }
}

function printTag(span: ISpan, key: string, value: TagValue, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printTag || filter.printTag(span, key, value)) {
        console.log(chalk.blue(`[tag]: id=${span.id} trace-id=${getColorString(span.traceId)} key=${key} value=${value}`));
    }
}

function printDone(span: ISpan, info: ISpanInfo, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printSpan || filter.printSpan(span)) {
        const text = `[end]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} time=${span.endTime}`; 
        console.log(info.isError ? chalk.red(text) : chalk.cyan(text));
    }
}

function getColorString(text: string): string {
    const hash = hashCode(text);
    const index = Math.abs(Math.round(Math.sin(hash) * (colors.length - 1)));
    return chalk.hex(colors[index])(text);
}

function hashCode(value: string): number {
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }

    return hash;
}