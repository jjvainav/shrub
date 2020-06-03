import chalk from "chalk";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILog, ISpan, ITracingConfiguration, LogLevel, TracingModule } from "@shrub/tracing";

export interface ITracingConsoleConfiguration {
    /** Adds a set of callbacks that define what should or should not be printed to the console; by default, everything gets printed. */
    addFilter(filter: IConsoleTraceFilter): void;
}

/** Options defining what to print to the console; by default all spans and logs are printed. */
export interface IConsoleTraceFilter {
    /** Determines whether or not the specified log information should be printed. */
    readonly printLog?: (log: ILog) => boolean;
    /** Determines if the specified start/end information for a span should be printed. */
    readonly printSpan?: (span: ISpan) => boolean;
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
                    printLog: log => {
                        if (base.printLog && !base.printLog(log)) {
                            return false;
                        }

                        if (filter.printLog && !filter.printLog(log)) {
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
        config.get(ITracingConfiguration).useObserver({
            start: (_, span) => printStart(span, this.filter),
            log: (span, log) => printLog(span, log, this.filter),
            done: (_, span) => printEnd(span, this.filter)
        });
    }
}

function printStart(span: ISpan, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printSpan || filter.printSpan(span)) {
        if (span.parentId) {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} parent-id=${span.parentId} time=${span.startTime} tags=${JSON.stringify(span.tags)}`));
        }
        else {
            console.log(chalk.cyan(`[start]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} time=${span.startTime} tags=${JSON.stringify(span.tags)}`));
        }
    }
}

function printLog(span: ISpan, log: ILog, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printLog || filter.printLog(log)) {
        const getText = (label: string) => `[${label}]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} data=${JSON.stringify(log.data)}`;

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

function printEnd(span: ISpan, filter?: IConsoleTraceFilter): void {
    if (!filter || !filter.printSpan || filter.printSpan(span)) {
        const text = `[end]: name=${span.name} id=${span.id} trace-id=${getColorString(span.traceId)} time=${span.endTime} tags=${JSON.stringify(span.tags)}`; 
        console.log(span.tags.error ? chalk.red(text) : chalk.cyan(text));
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