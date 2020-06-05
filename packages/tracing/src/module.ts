import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { LoggingModule } from "@shrub/logging";
import { ISpanContextProvider, ITraceWriter, ITracingService, TracingService } from "./service";

export const ITracingConfiguration = createConfig<ITracingConfiguration>();
export interface ITracingConfiguration {
    /** Registers a global span context provider for the tracing service. */
    useContextProvider(provider: ISpanContextProvider): void;
    /** Registers a global trace writer for the tracing service. */
    useTraceWriter(writer: ITraceWriter): void; 
}

export class TracingModule implements IModule {
    readonly name = "tracing";
    readonly dependencies = [LoggingModule];

    initialize(init: IModuleInitializer): void {
        init.config(ITracingConfiguration).register(({ services }) => ({
            useContextProvider: provider => (<TracingService>services.get(ITracingService)).useContextProvider(provider),
            useTraceWriter: writer => (<TracingService>services.get(ITracingService)).useTraceWriter(writer)
        }));
    }    

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITracingService, TracingService);
    }
}