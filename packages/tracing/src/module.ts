import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ILogDataConverter, ISpanContextProvider, ITraceObserver, ITracingService, TracingService } from "./service";

export const ITracingConfiguration = createConfig<ITracingConfiguration>();
export interface ITracingConfiguration {
    /** Registers a global span context provider for the tracing service. */
    useContextProvider(provider: ISpanContextProvider): void;
    /** Registers a log data converter with the builder. The log data converter handles converting logged data into ILogData objects. */
    useLogDataConverter(converter: ILogDataConverter): void;
    /** Registers a global observer for the tracing service. */
    useObserver(observer: ITraceObserver): void; 
}

export class TracingModule implements IModule {
    readonly name = "tracing";

    initialize(init: IModuleInitializer): void {
        init.config(ITracingConfiguration).register(({ services }) => ({
            useContextProvider: provider => (<TracingService>services.get(ITracingService)).useContextProvider(provider),
            useLogDataConverter: converter => (<TracingService>services.get(ITracingService)).useLogDataConverter(converter),
            useObserver: observer => (<TracingService>services.get(ITracingService)).useObserver(observer)
        }));
    }    

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITracingService, TracingService);
    }
}