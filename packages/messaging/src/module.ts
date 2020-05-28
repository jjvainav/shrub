import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IMessageBrokerAdapter, IMessageBrokerAdapterOptions, IMessageService, MessageService } from "./service";

export const IMessagingConfiguration = createConfig<IMessagingConfiguration>();
export interface IMessagingConfiguration {
    /** Registers a message broker adapter. */
    useMessageBroker(adapter: IMessageBrokerAdapter, options?: IMessageBrokerAdapterOptions): void;
}

export class MessagingModule implements IModule {
    readonly name = "messaging";

    initialize(init: IModuleInitializer): void {
        init.config(IMessagingConfiguration).register(({ services }) => ({
            useMessageBroker: (adapter, options) => services.get(IMessageService).registerBroker(adapter, options)
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IMessageService, MessageService);
    }
}