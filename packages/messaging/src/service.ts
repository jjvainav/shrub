import { createInjectable, createService, Singleton } from "@shrub/core";
import { ILogger } from "@shrub/logging";
import createId from "@sprig/unique-id";
import { IMessage, MessageMetadata } from "./message";

/** Handles a message and optionally returns a promise to support async message handling and prevent the next message from being processed until this handler finishes. */
export type MessageHandler = (message: IMessage, channel: string) => void | Promise<void>;

export interface IMessageService {
    /** Gets a consumer used to subscribe to messaging channels. */
    getConsumer(): IMessageConsumer;
    /** Gets a producer used to send messages to consumers. */
    getProducer(): IMessageProducer;
}

/** @internal */
export interface IMessageBrokerService {
    /** Registers a message broker with the service; a message broker is responsible for providing consumers/producers based on channel names. */
    registerBroker(adapter: IMessageBrokerAdapter): void;
}

/** An adapter to an external message broker system for handling the control of messages. */
export interface IMessageBrokerAdapter {
    /** Gets a consumer for the specified channel name pattern or undefined if a consumer is not available for the channel. */
    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined;
    /** Gets a producer for the specified channel or undefined if a producer is not available for the channel. */
    getChannelProducer(channelName: string): IMessageChannelProducer | undefined;
}

/** Represents message details to send via a producer. */
export interface IMessageDetails {
    /** A set of metadata for the message defined as key/value pairs. */
    readonly metadata?: MessageMetadata;
    /** The message payload. */
    readonly data: any;
}

/** Defines the options for subscribing to a consumer. */
export interface ISubscribeOptions {
    /** 
     * Identifies the subscriber; multiple subscriptions with the same subscriber id will be treated as competing consumers (i.e. only one subscription will handle a message). 
     * Support for subscription id's is expected to be handled by the message brokers, so it is not guaranteed this feature will be supported for all consumers.
     */
    readonly subscriptionId: string;
    /** An optional logger to pass to the consumer to enable logging inside the subscription. */
    readonly logger?: ILogger;
    /** A callback to handle the message. */
    readonly handler: MessageHandler;
}

/** Represents a message consumer subscription. */
export interface ISubscription {
    /** Unsubscribes from the consumer. */
    unsubscribe(): Promise<void>;
}

/** Defines a consumer for a message broker. */
export interface IMessageConsumer {
    /** Registers to and listens for messages based on a given channel name pattern. */
    subscribe(channelNamePattern: string, optionsOrHandler: ISubscribeOptions | MessageHandler): Promise<ISubscription>;
}

/** Handles sending messages. */
export interface IMessageProducer {
    /** Sends a message to consumers subscribed to the specified channel. */
    send(channelName: string, message: IMessageDetails): Promise<void>;
}

/** Defines a consumer for a specific channel. */
export interface IMessageChannelConsumer {
    /** Subscribes to the message consumer. */
    subscribe(options: ISubscribeOptions): Promise<ISubscription>;
}

/** Defines a producer for sending messages over a specific channel. */
export interface IMessageChannelProducer {
    /** Sends a message on the channel. */
    send(message: IMessageDetails): Promise<void>;
}

export const IMessageService = createService<IMessageService>("message-service");

/** @internal */
export const IMessageBrokerService = createService<IMessageBrokerService>("message-broker-service");

/** A decorator for injecting message consumers. */
export const IMessageConsumer = createInjectable<IMessageConsumer>({
    key: "message-consumer",
    factory: services => ({ subscribe: (channelNamePattern, optionsOrHandler) => services.get(IMessageService).getConsumer().subscribe(channelNamePattern, optionsOrHandler) })
});

/** A decorator for injecting message producers. */
export const IMessageProducer = createInjectable<IMessageProducer>({
    key: "message-producer",
    factory: services => ({ send: (channelName, message) => services.get(IMessageService).getProducer().send(channelName, message) })
});

/** @internal */
@Singleton
export class MessageService implements IMessageService {
    private readonly adapters: IMessageBrokerAdapter[] = [];

    getConsumer(): IMessageConsumer {
        return {
            subscribe: (channelNamePattern, optionsOrHandler) => {
                const subscriptions: Promise<ISubscription>[] = [];
                const options = typeof optionsOrHandler !== "function" ? optionsOrHandler :{
                    subscriptionId: createId(),
                    handler: optionsOrHandler
                };

                for (const adapter of this.adapters) {
                    if (adapter.getChannelConsumer) {
                        const consumer = adapter.getChannelConsumer(channelNamePattern);
                        if (consumer) {
                            subscriptions.push(consumer.subscribe(options));
                        }
                    }
                }
        
                if (!subscriptions.length) {
                    throw new Error(`No registered message brokers to handle channel consumer with pattern (${channelNamePattern}).`);
                }

                return Promise.all(subscriptions).then(subscriptions => ({
                    unsubscribe: async () => {
                        await Promise.all(subscriptions.map(subscription => subscription.unsubscribe()));
                    }
                }));
            }
        };
    }

    getProducer(): IMessageProducer {
        return {
            send: async (channelName, message) => {
                const producers: IMessageChannelProducer[] = [];

                for (const adapter of this.adapters) {
                    if (adapter.getChannelProducer) {
                        const producer = adapter.getChannelProducer(channelName);
                        if (producer) {
                            producers.push(producer);
                        }
                    }
                }
        
                if (!producers.length) {
                    throw new Error(`No registered message brokers to handle channel producer (${channelName}).`);
                }

                await Promise.all(producers.map(producer => producer.send(message)));
            }
        };
    }

    registerBroker(adapter: IMessageBrokerAdapter): void {        
        this.adapters.push(adapter);
    }
}