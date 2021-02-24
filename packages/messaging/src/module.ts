import { createConfig, IModule, IModuleInitializer, IServiceRegistration, SingletonServiceFactory } from "@shrub/core";
import { LoggingModule } from "@shrub/logging";
import { IMessageBrokerAdapter, IMessageBrokerService, IMessageService, MessageService } from "./service";

export const IMessagingConfiguration = createConfig<IMessagingConfiguration>();
export interface IMessagingConfiguration {
    /** Registers a message broker adapter. */
    useMessageBroker(adapter: IMessageBrokerAdapter): void;
}

export class MessagingModule implements IModule {
    readonly name = "messaging";
    readonly dependencies = [LoggingModule];

    initialize(init: IModuleInitializer): void {
        init.config(IMessagingConfiguration).register(({ services }) => ({
            useMessageBroker: adapter => services.get(IMessageBrokerService).registerBroker(adapter)
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        const factory = new SingletonServiceFactory(MessageService);
        registration.registerSingleton(IMessageService, factory);
        registration.registerSingleton(IMessageBrokerService, factory);
    }
}