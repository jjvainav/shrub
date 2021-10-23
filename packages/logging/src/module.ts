import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ILogDataConverter, ILogWriter, ILoggingRegistrationService, ILoggingService, LoggingRegistrationService, LoggingService } from "./service";

export const ILoggingConfiguration = createConfig<ILoggingConfiguration>();
export interface ILoggingConfiguration {
    /** Registers a global log data converter. */
    useConverter(converter: ILogDataConverter): void;
    /** Registers a global log writer. */
    useWriter(writer: ILogWriter): void;
}

export class LoggingModule implements IModule {
    readonly name = "logging";

    initialize(init: IModuleInitializer): void {
        init.config(ILoggingConfiguration).register(({ services }) => ({
            useConverter: converter => services.get(ILoggingRegistrationService).useConverter(converter),
            useWriter: writer => services.get(ILoggingRegistrationService).useWriter(writer)
        }));
    }    

    configureServices(registration: IServiceRegistration): void {
        registration.register(ILoggingRegistrationService, LoggingRegistrationService, { sealed: true });
        registration.register(ILoggingService, LoggingService);
    }
}