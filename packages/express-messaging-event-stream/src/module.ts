import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration, SingletonServiceFactory } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IMessagingConfiguration, MessagingModule } from "@shrub/messaging";
import { EventStreamService, IEventStreamMetricsService, IEventStreamService } from "./service";

export const IExpressMessagingEventStreamConfiguration = createConfig<IExpressMessagingEventStreamConfiguration>();
export interface IExpressMessagingEventStreamConfiguration {
    /** Add a channel name pattern to the list of supported channel names; if no channels are whitelisted then all channels will be supported. */
    whitelistChannel(channelNamePattern: string): void;
}

export class ExpressMessagingEventStreamModule implements IModule {
    readonly name = "express-messaging-event-stream";
    readonly dependencies = [
        ExpressModule,
        MessagingModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressMessagingEventStreamConfiguration).register(({ services }) => ({
            whitelistChannel: channelNamePattern => services.get(IEventStreamService).whitelistChannel(channelNamePattern)
        }));
    }
    
    configureServices(registration: IServiceRegistration): void {
        const factory = new SingletonServiceFactory(EventStreamService);
        registration.registerSingleton(IEventStreamService, factory);
        registration.registerSingleton(IEventStreamMetricsService, factory);
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IMessagingConfiguration).useMessageBroker({
            getChannelConsumer: () => undefined,
            getChannelProducer: channelName => services.get(IEventStreamService).getMessageChannelProducer(channelName)
        });
    }
}