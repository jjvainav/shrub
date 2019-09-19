import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ISerializer, ISpanContextProvider, ITraceObserver, ITracingService, TracingService } from "./service";

export const ITracingConfiguration = createConfig<ITracingConfiguration>();
export interface ITracingConfiguration {
    /** Registers a global span context provider for the tracing service. */
    useContextProvider(provider: ISpanContextProvider): void;
    /** 
     * Registers a global serializer for the tracing service. A serializer gets invoked for every json object logged
     * so it is the responsibility of the serializer to check the object type and handle when necessary
     * and simply return the provided log data object if the serializer wants to skip handling the object.
     */
    useSerializer(serializer: ISerializer): void;
    /** Registers a global observer for the tracing service. */
    useObserver(observer: ITraceObserver): void; 
}

export class TracingModule implements IModule {
    readonly name = "tracing";

    initialize(init: IModuleInitializer): void {
        init.config(ITracingConfiguration).register(({ services }) => ({
            useContextProvider: provider => (<TracingService>services.get(ITracingService)).useContextProvider(provider),
            useSerializer: serializer => (<TracingService>services.get(ITracingService)).useSerializer(serializer),
            useObserver: observer => (<TracingService>services.get(ITracingService)).useObserver(observer)
        }));
    }    

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITracingService, TracingService);
    }    
}