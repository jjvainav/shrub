import { createInjectable, createService, Singleton } from "@shrub/core";
import { ILogger } from "@shrub/logging";
import { IMessage, MessageMetadata } from "./message";

/** Handles a message and optionally returns a promise to support async message handling and prevent the next message from being processed until this handler finishes. */
export type MessageHandler = (message: IMessage) => void | Promise<void>;

/** @internal */
export interface IMessageService {
    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer;
    getChannelProducer(channelName: string): IMessageChannelProducer;
    registerBroker(adapter: IMessageBrokerAdapter): void;
}

/** An adapter to an external message broker system for handling the control of messages. */
export interface IMessageBrokerAdapter {
    /** Gets a consumer for the specified channel name pattern or undefined if a consumer is not available for the channel. */
    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined;
    /** Gets a producer for the specified channel or undefined if a producer is not available for the channel. */
    getChannelProducer(channelName: string): IMessageChannelProducer | undefined;
}

/** Defines the options for sending a message via a producer. */
export interface IMessageProducerSendOptions {
    /** A set of metadata for the message defined as key/value pairs. */
    readonly metadata?: MessageMetadata;
    /** The message payload. */
    readonly data: any;
}

/** Defines the options for subscribing to a consumer. */
export interface IMessageConsumerSubscribeOptions {
    /** Identifies the subscriber; multiple subscriptions with the same subscriber id will be treated as competing consumers (i.e. only one subscription will handle a message). */
    readonly subscriptionId: string;
    /** An optional logger to pass to the consumer to enable logging inside the subscription. */
    readonly logger?: ILogger;
    /** A callback to handle the message. */
    readonly handler: MessageHandler;
}

/** Represents a message consumer subscription. */
export interface ISubscription {
    /** Unsubscribes from the consumer. */
    unsubscribe(): void;
}

/** Defines a consumer for a message broker. */
export interface IMessageConsumer {
    /** Subscribes to the message consumer. */
    subscribe(channelNamePattern: string, options: IMessageConsumerSubscribeOptions): Promise<ISubscription>;
}

/** Handles sending messages. */
export interface IMessageProducer {
    /** Sends a message to the specified channel. */
    send(channelName: string, options: IMessageProducerSendOptions): void;
}

/** Defines a consumer for a specific channel. */
export interface IMessageChannelConsumer {
    /** Subscribes to the message consumer. */
    subscribe(options: IMessageConsumerSubscribeOptions): Promise<ISubscription>;
}

/** Defines a producer for sending messages over a specific channel. */
export interface IMessageChannelProducer {
    /** Sends a message on the channel. */
    send(options: IMessageProducerSendOptions): void;
}

/** @internal */
export const IMessageService = createService<IMessageService>("message-service");

/** A decorator for injecting message consumers. */
export const IMessageConsumer = createInjectable<IMessageConsumer>({
    key: "message-consumer",
    factory: services => ({ subscribe: (channelNamePattern, options) => services.get(IMessageService).getChannelConsumer(channelNamePattern).subscribe(options) })
});

/** A decorator for injecting message producers. */
export const IMessageProducer = createInjectable<IMessageProducer>({
    key: "message-producer",
    factory: services => ({ send: (channelName, options) => services.get(IMessageService).getChannelProducer(channelName).send(options) })
});

/** 
 * A utility to validate if a channel name matches the specified channel name pattern. 
 * Currently, channel name patterns only support wildcard (*).
 */
export function isChannelNameMatch(channelNamePattern: string, channelName: string): boolean {
    const regex = toRegExp(channelNamePattern);
    return regex.test(channelName);
}

/** Returns true if the provided channel name is a pattern containing one or more wildcards. */
export function isChannelNamePattern(channelName: string): boolean {
    for (let i = 0; i < channelName.length; i++) {
        if (channelName[i] === "*") {
            return true;
        }
    }

    return false;
}

function toRegExp(pattern: string): RegExp {
    const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    pattern = "^" + pattern.split("*").map(escapeRegex).join(".*") + "$";
    return new RegExp(pattern);
}

/** @internal */
@Singleton
export class MessageService implements IMessageService {
    private readonly adapters: IMessageBrokerAdapter[] = [];

    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer {
        for (const adapter of this.adapters) {
            if (adapter.getChannelConsumer) {
                const consumer = adapter.getChannelConsumer(channelNamePattern);
                if (consumer) {
                    return consumer;
                }
            }
        }

        throw new Error(`No registered message brokers to handle channel consumer with pattern (${channelNamePattern}).`);
    }

    getChannelProducer(channelName: string): IMessageChannelProducer {
        for (const adapter of this.adapters) {
            if (adapter.getChannelProducer) {
                const producer = adapter.getChannelProducer(channelName);
                if (producer) {
                    return producer;
                }
            }
        }

        throw new Error(`No registered message brokers to handle channel producer (${channelName}).`);
    }

    registerBroker(adapter: IMessageBrokerAdapter): void {        
        this.adapters.push(adapter);
    }
}