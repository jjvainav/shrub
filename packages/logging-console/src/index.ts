import chalk from "chalk";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogEntry, ILoggingConfiguration, LoggingModule, LogLevel } from "@shrub/logging";

export interface ILoggingConsoleConfiguration {
    /** Adds a filter that determines what should or should not be printed to the console; by default, everything gets printed. */
    addFilter(filter: IConsoleLoggingFilter): void;
}

/** A filter that defines what to print to the console; by default all logs are printed. */
export interface IConsoleLoggingFilter {
    /** Determines whether or not the specified log information should be printed. */
    readonly printLog: (log: ILogEntry) => boolean;
}

export const ILoggingConsoleConfiguration = createConfig<ILoggingConsoleConfiguration>();

export class LoggingConsoleModule implements IModule {
    private filter?: IConsoleLoggingFilter;

    readonly name = "logging-console";
    readonly dependencies = [LoggingModule];

    initialize(init: IModuleInitializer): void {
        init.config(ILoggingConsoleConfiguration).register(() => ({
            addFilter: filter => {
                const base = this.filter;
                this.filter = !base ? filter : {
                    printLog: log => base.printLog(log) && filter.printLog(log)
                };
            }
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(ILoggingConfiguration).useWriter({
            writeLog: entry => printLog(entry, this.filter)
        });
    }
}

function printLog(entry: ILogEntry, filter?: IConsoleLoggingFilter): void {
    if (!filter || !filter.printLog || filter.printLog(entry)) {
        const getText = (label: string) => `[${label}]: data=${JSON.stringify(entry.data)}`;

        if (entry.level < LogLevel.info) {
            console.log(chalk.magenta(getText("debug")));
        }
        else if (entry.level < LogLevel.warn) {
            console.log(chalk.green(getText("info")));
        }
        else if (entry.level < LogLevel.error) {
            console.log(chalk.yellow(getText("warn")));
        }
        else {
            console.log(chalk.bgRed(getText("error")));
        }
    }
}