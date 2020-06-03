import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IMessageBrokerAdapter, IMessagingConfiguration, MessagingModule } from "@shrub/messaging";
import { EventStreamConsumerService, IEventStreamConsumerOptions, IEventStreamConsumerService } from "./services/consumer";
import { EventStreamProducerService, IEventStreamProducerService } from "./services/producer";

export const IExpressEventStreamConfiguration = createConfig<IExpressEventStreamConfiguration>();
export interface IExpressEventStreamConfiguration {
    /** Adds an event-stream consumer with the messaging message broker. */
    addConsumer(options: IEventStreamConsumerOptions): void;
    /** 
     * Enables the event-stream producer with the messaging message broker and
     * is required when using the EventStreamChannel controller decorator.
     */
    enableProducer(options?: IEventStreamProducerOptions): void;
}

/** Defines options for the event-stream producer. */
export interface IEventStreamProducerOptions {
    /** A set of channel name patterns to whitelist for the producer; if no channels are specified then all channels will be supported. */
    readonly whitelist?: string[];
}

export class ExpressEventStreamModule implements IModule {
    private broker?: IMessageBrokerAdapter;

    readonly name = "express-event-stream";
    readonly dependencies = [
        ExpressModule,
        MessagingModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressEventStreamConfiguration).register(({ services }) => ({
            addConsumer: options => this.appendConsumer(services.get(IEventStreamConsumerService), options),
            enableProducer: options => this.enableProducer(services.get(IEventStreamProducerService), options)
        }));
    }
    
    configureServices(registration: IServiceRegistration): void {
        registration.register(IEventStreamConsumerService, EventStreamConsumerService);
        registration.register(IEventStreamProducerService, EventStreamProducerService);
    }

    configure({ config }: IModuleConfigurator): void {
        if (this.broker) {
            config.get(IMessagingConfiguration).useMessageBroker(this.broker);
        }
    }

    private appendConsumer(service: IEventStreamConsumerService, options: IEventStreamConsumerOptions): void {
        this.broker = this.broker || {};

        const previous = this.broker.getChannelConsumer;
        const next = (channelNamePattern: string) => service.getMessageChannelConsumer(channelNamePattern, options);

        this.broker = {
            getChannelProducer: this.broker.getChannelProducer,
            getChannelConsumer: !previous ? next : channelNamePattern => previous(channelNamePattern) || next(channelNamePattern)
        };
    }

    private enableProducer(service: IEventStreamProducerService, options?: IEventStreamProducerOptions): void {
        this.broker = this.broker || {};

        if (!this.broker.getChannelProducer) {
            this.broker = {
                getChannelProducer: channelName => service.getMessageChannelProducer(channelName),
                getChannelConsumer: this.broker.getChannelConsumer
            };
        }

        if (options && options.whitelist) {
            options.whitelist.forEach(entry => service.whitelistChannel(entry));
        }
    }
}