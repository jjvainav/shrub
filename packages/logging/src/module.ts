import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ILogDataConverter, ILogWriter, ILoggingService, LoggingService } from "./service";

export const ILoggingConfiguration = createConfig<ILoggingConfiguration>();
export interface ILoggingConfiguration {
    /** Registers a global log data converter. */
    useLogDataConverter(converter: ILogDataConverter): void;
    /** Registers a global log writer. */
    useLogWriter(writer: ILogWriter): void;
}

export class LoggingModule implements IModule {
    readonly name = "logging";

    initialize(init: IModuleInitializer): void {
        init.config(ILoggingConfiguration).register(({ services }) => ({
            useLogDataConverter: converter => (<LoggingService>services.get(ILoggingService)).useLogDataConverter(converter),
            useLogWriter: writer => (<LoggingService>services.get(ILoggingService)).useLogWriter(writer)
        }));
    }    

    configureServices(registration: IServiceRegistration): void {
        registration.register(ILoggingService, LoggingService);
    }
}