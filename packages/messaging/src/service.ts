import { createInjectable, createService, Singleton } from "@shrub/core";
import { IMessage, IMessageDetails } from "./message";

/** Handles a message and optionally returns a promise to support async message handling and prevent the next message from being processed until this handler finishes. */
export type MessageHandler = (message: IMessage) => void | Promise<void>;

/** @internal */
export interface IMessageService {
    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer;
    getChannelProducer(channelName: string): IMessageChannelProducer;
    registerBroker(adapter: IMessageBrokerAdapter): void;
}

// TODO: a channel may be pub/sub or it maybe persistent - will it be necessary to know this?

/** An adapter to an external message broker system for handling the control of messages. */
export interface IMessageBrokerAdapter {
    /** Gets a consumer for the specified channel name pattern or undefined if a consumer is not available for the channel. */
    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined;
    /** Gets a producer for the specified channel or undefined if a producer is not available for the channel. */
    getChannelProducer(channelName: string): IMessageChannelProducer | undefined;
}

/** Defines a consumer for a specific channel. */
export interface IMessageChannelConsumer {
    /** Subscribes to the message consumer. */
    subscribe(subscriberId: string, handler: MessageHandler): Promise<ISubscription>;
}

/** Responsible for sending a message over a specific channel. */
export interface IMessageChannelProducer {
    /** Sends a message on the channel. */
    send(message: IMessageDetails): void;
}

/** Defines a consumer for a message broker. */
export interface IMessageConsumer {
    /** Subscribes to the message consumer. */
    subscribe(options: IMessageConsumerOptions): Promise<ISubscription>;
}

/** Options for subscribing to a consumer. */
export interface IMessageConsumerOptions {
    /** Identifies the subscriber; multiple subscriptions with the same subscriber id will be treated as competing consumers (i.e. only one subscription will handle a message). */
    readonly subscriberId: string;
    /** A name pattern for the channel(s) to subscribe to; a name pattern currently supports basic pattern matching using the * as a wildcard. */
    readonly channelNamePattern: string;
    /** A callback to handle the message. */
    readonly handler: MessageHandler;
}

/** Represents a message consumer subscription. */
export interface ISubscription {
    /** Unsubscribes from the consumer. */
    unsubscribe(): void;
}

/** Handles sending messages. */
export interface IMessageProducer {
    /** Sends a message to the specified channel. */
    send(channelName: string, message: IMessageDetails): void;
}

/** @internal */
export const IMessageService = createService<IMessageService>("message-service");

/** A decorator for injecting message consumers. */
export const IMessageConsumer = createInjectable<IMessageConsumer>({
    key: "message-consumer",
    factory: services => ({ subscribe: options => services.get(IMessageService).getChannelConsumer(options.channelNamePattern).subscribe(options.subscriberId, options.handler) })
});

/** A decorator for injecting message producers. */
export const IMessageProducer = createInjectable<IMessageProducer>({
    key: "message-producer",
    factory: services => ({ send: (channelName, message) => services.get(IMessageService).getChannelProducer(channelName).send(message) })
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
            const consumer = adapter.getChannelConsumer(channelNamePattern);
            if (consumer) {
                return consumer;
            }
        }

        throw new Error(`No registered message brokers to handle channel consumer with pattern (${channelNamePattern}).`);
    }

    getChannelProducer(channelName: string): IMessageChannelProducer {
        for (const adapter of this.adapters) {
            const producer = adapter.getChannelProducer(channelName);
            if (producer) {
                return producer;
            }
        }

        throw new Error(`No registered message brokers to handle channel producer (${channelName}).`);
    }

    registerBroker(adapter: IMessageBrokerAdapter): void {        
        this.adapters.push(adapter);
    }
}