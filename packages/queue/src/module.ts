import { createConfig, IModule, IModuleInitializer, IServiceRegistration, SingletonServiceFactory } from "@shrub/core";
import { IQueueAdapter } from "./queue";
import { IQueueAdapterService, IQueueService, QueueService } from "./service";

export const IQueueConfiguration = createConfig<IQueueConfiguration>();
export interface IQueueConfiguration {
    /** Registers a queue adapter. */
    useQueue(adapter: IQueueAdapter): void;
}

export class QueueModule implements IModule {
    readonly name = "queue";

    initialize(init: IModuleInitializer): void {
        init.config(IQueueConfiguration).register(({ services }) => ({
            useQueue: adapter => services.get(IQueueAdapterService).register(adapter)
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        const factory = new SingletonServiceFactory(QueueService);
        registration.registerSingleton(IQueueService, factory);
        registration.registerSingleton(IQueueAdapterService, factory);
    }
}