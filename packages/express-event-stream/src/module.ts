import { createConfig, IModule, IModuleConfiguration, IModuleConfigurator, IModuleInitializer, IServiceCollection, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { IMessageBrokerAdapter, IMessageChannelConsumer, IMessageChannelProducer, IMessagingConfiguration, MessagingModule } from "@shrub/messaging";
import { PathParams } from "express-serve-static-core";
import { validateConsumerParams } from "./middleware";
import { EventStreamConsumerService, IEventStreamConsumerConfiguration, IEventStreamConsumerService } from "./services/consumer";
import { EventStreamProducerService, IEventStreamProducerService } from "./services/producer";

export const IExpressEventStreamConfiguration = createConfig<IExpressEventStreamConfiguration>();
export interface IExpressEventStreamConfiguration {
    /** Adds an event-stream consumer with the messaging message broker. */
    addConsumer(config: IEventStreamConsumerConfiguration): void;
    /** Register and configures the use of the event-stream producer; note, this is still required when using the EventStreamChannel controller decorator. */
    useProducer(options?: IEventStreamProducerOptions): void;
}

/** Defines a route for an event-stream producer. */
export interface IEventStreamProducerRoute { 
    /** The path for the producer endpoint where event-stream consumers can register. */
    readonly path: PathParams, 
    /** A channel name pattern to restrict what channels consumers of the endpoint can subscribe to; the default is '*'. */
    readonly channelNamePattern?: string 
}

/** Defines options for the event-stream producer. */
export interface IEventStreamProducerOptions {
    /** A set of routes that will accept event-stream consumer subscriptions. Routes can be defined here or using the EventStreamChannel controller decorator. */
    readonly routes?: IEventStreamProducerRoute[];
    /**
     * A set of defined channel name patterns the producer will send messages to and is used in a couple different scenarios:
     * 1. This is required when using the EventStreamChannel controller decorator as it does not have access to register the channel name patterns with the service.
     * 2. When using multiple routes and you'd like to optimize the produce with a shortened list of patterns that cover all the configured routes.
     */
    readonly channelNamePatterns?: string[];
}

/** 
 * A module that provides support for brokerless messaging using event-streams. The consumer connects to an event-stream endpoint
 * representing a channel name. The producer ties into express and opens an event-stream for a request route. 
 */
export class ExpressEventStreamModule implements IModule {
    private broker?: EventStreamMessageBrokerAdapter;

    readonly name = "express-event-stream";
    readonly dependencies = [
        ExpressModule,
        MessagingModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressEventStreamConfiguration).register(({ config, services }) => {
            const broker = this.getMessageBroker(config, services);
            return {
                addConsumer: config => broker.addConsumer(config),
                useProducer: options => broker.useProducer(options)
            };
        });
    }
    
    configureServices(registration: IServiceRegistration): void {
        registration.register(IEventStreamConsumerService, EventStreamConsumerService);
        registration.register(IEventStreamProducerService, EventStreamProducerService);
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IMessagingConfiguration).useMessageBroker(this.getMessageBroker(config, services));
    }

    private getMessageBroker(config: IModuleConfiguration, services: IServiceCollection): EventStreamMessageBrokerAdapter {
        this.broker = this.broker || new EventStreamMessageBrokerAdapter(
            config.get(IExpressConfiguration),
            services.get(IEventStreamConsumerService),
            services.get(IEventStreamProducerService)
        );

        return this.broker;
    }
}

class EventStreamMessageBrokerAdapter implements IMessageBrokerAdapter {
    constructor(
        private readonly app: IExpressConfiguration, 
        private readonly consumerService: IEventStreamConsumerService,
        private readonly producerService: IEventStreamProducerService) {
    }

    addConsumer(config: IEventStreamConsumerConfiguration): void {
        this.consumerService.addConsumer(config);
    }

    useProducer(options?: IEventStreamProducerOptions): void {
        const channelNamePatterns = options && options.channelNamePatterns || ["*"];
        channelNamePatterns.forEach(pattern => this.producerService.whitelistChannel(pattern));

        if (options && options.routes) {
            for (const route of options.routes) {
                this.producerService.whitelistChannel(route.channelNamePattern || "*");
                this.app.use(route.path, (req, res, next) => validateConsumerParams(route.channelNamePattern, req, res, (channel, subscriptionId) => {
                    this.producerService.openStream(channel, subscriptionId, req, res);
                    next();
                }));
            }
        }
    }

    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined {
        return this.consumerService.getMessageChannelConsumer(channelNamePattern);
    }

    getChannelProducer(channelName: string): IMessageChannelProducer | undefined {
        return this.producerService.getMessageChannelProducer(channelName);
    }
}