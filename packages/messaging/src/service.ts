import { createInjectable, createService, Singleton } from "@shrub/core";
import { IMessage } from "./message";

/** Handles a message and optionally returns a promise to support async message handling and prevent the next message from being processed until this handler finishes. */
export type MessageHandler = (message: IMessage) => void | Promise<void>;

/** @internal */
export interface IMessageService {
    getChannelConsumer(channelName: string): IMessageChannelConsumer;
    getChannelProducer(channelName: string): IMessageChannelProducer;
    registerBroker(adapter: IMessageBrokerAdapter, options?: IMessageBrokerAdapterOptions): void;
}

// TODO: a channel may be pub/sub or it maybe persistent - will it be necessary to know this?

/** An adapter to an external message broker system for handling the control of messages. */
export interface IMessageBrokerAdapter {
    /** Gets a consumer for the specified channel or undefined if a consumer is not available for the channel. */
    getChannelConsumer(channelName: string): IMessageChannelConsumer | undefined;
    /** Gets a producer for the specified channel or undefined if a producer is not available for the channel. */
    getChannelProducer(channelName: string): IMessageChannelProducer | undefined;
}

/** Defines options for a message broker adapter. */
export interface IMessageBrokerAdapterOptions {
    /** 
     * Defines a set of known channels for the broker; each name supports optional wildcards (*). 
     * If no channels are provided the broker is then assumed to handle all requests.
     */
    readonly channelNames?: string[];
}

/** Defines a consumer for a specific channel. */
export interface IMessageChannelConsumer {
    /** Subscribes to the message consumer. */
    subscribe(subscriberId: string, handler: MessageHandler): ISubscription;
}

/** Responsible for sending a message over a specific channel. */
export interface IMessageChannelProducer {
    /** Sends a message on the channel. */
    send(message: IMessage): void;
}

/** Defines a consumer for a message broker. */
export interface IMessageConsumer {
    /** Subscribes to the message consumer. */
    subscribe(options: IMessageConsumerOptions): ISubscription;
}

/** Options for subscribing to a consumer. */
export interface IMessageConsumerOptions {
    /** Identifies the subscriber; multiple subscriptions with the same subscriber id will be treated as competing consumers (i.e. only one subscription will handle a message). */
    readonly subscriberId: string;
    /** The name of the channel to subscribe to; note, a channel name supports basic pattern matching using the * as a wildcard. */
    readonly channelName: string;
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
    send(channelName: string, message: IMessage): void;
}

/** @internal */
export const IMessageService = createService<IMessageService>("message-service");

/** A decorator for injecting message consumers. */
export const IMessageConsumer = createInjectable<IMessageConsumer>({
    key: "message-consumer",
    factory: services => ({ subscribe: options => services.get(IMessageService).getChannelConsumer(options.channelName).subscribe(options.subscriberId, options.handler) })
});

/** A decorator for injecting message producers. */
export const IMessageProducer = createInjectable<IMessageProducer>({
    key: "message-producer",
    factory: services => ({ send: (channelName, message) => services.get(IMessageService).getChannelProducer(channelName).send(message) })
});

/** @internal */
@Singleton
export class MessageService implements IMessageService {
    private readonly adapters: [IMessageBrokerAdapter, string[]][] = [];
    private defaultAdapter?: IMessageBrokerAdapter;

    getChannelConsumer(channelName: string): IMessageChannelConsumer {
        return this.getChannelComponent(channelName, adapter => adapter.getChannelConsumer(channelName));
    }

    getChannelProducer(channelName: string): IMessageChannelProducer {
        return this.getChannelComponent(channelName, adapter => adapter.getChannelProducer(channelName));
    }

    registerBroker(adapter: IMessageBrokerAdapter, options?: IMessageBrokerAdapterOptions): void {        
        if (!options || !options.channelNames || !options.channelNames.length) {
            if (!this.defaultAdapter) {
                // TODO: log a warning and return instead of throwing?
                throw new Error("A default broker adapter is already registered, must provide one or more channel names.");
            }

            this.defaultAdapter = adapter;
            return;
        }

        this.adapters.push([adapter, options.channelNames]);
    }

    private getChannelComponent<T>(channelName: string, get: (adapter: IMessageBrokerAdapter) => T | undefined): T {
        for (const adapter of this.getMatchingAdapters(channelName)) {
            const component = get(adapter);
            if (component) {
                return component;
            }
        }

        throw new Error(`No registered message brokers to handle channel (${channelName}).`);
    }

    private getMatchingAdapters(channelName: string): IMessageBrokerAdapter[] {
        const adapters = this.defaultAdapter ? [this.defaultAdapter] : [];

        for (const item of this.adapters) {
            for (const pattern of item[1]) {
                if (this.match(pattern, channelName)) {
                    // keep the default adapter at the end of the list
                    adapters.unshift(item[0]);
                }
            }
        }

        return adapters;
    }

    private match(pattern: string, value: string): boolean {
        const regex = this.toRegExp(pattern);
        return regex.test(value);
    }
    
    private toRegExp(pattern: string): RegExp {
        const escapeRegex = (str: string) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        pattern = "^" + pattern.split("*").map(escapeRegex).join(".*") + "$";
        return new RegExp(pattern);
    }
}