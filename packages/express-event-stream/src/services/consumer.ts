import { createService, Singleton } from "@shrub/core";
import { ILogger } from "@shrub/logging";
import { IMessage, IMessageChannelConsumer, isChannelNameMatch, ISubscribeOptions, ISubscription, Message, MessageHandler } from "@shrub/messaging";
import { IRequest, IRequestPromise } from "@sprig/request-client";
import { IRequestEventStream, jsonValidator, RequestEventStream } from "@sprig/request-client-events";
import urlJoin from "url-join";

/** Represents an endpoint and channel mapping for a consumer to connect to. */
export interface IEventStreamEndpoint {
    /** A set of patterns the endpoint supports; the default is '*' to represent 'all'.  */
    readonly channelNamePatterns?: string[];
    /** A url to connect to. */
    readonly url: string;
}

/** Interceptors that get passed to the underlying RequestEventStream. */
export interface IEventStreamInterceptors {
    readonly beforeRequest?: (request: IRequest) => IRequest;
    readonly afterRequest?: (promise: IRequestPromise) => IRequestPromise;
}

/** Defines configuration for an event-stream consumer. */
export interface IEventStreamConsumerConfiguration {
    /** A set of endpoints for the consumer to connect to. */
    readonly endpoints: IEventStreamEndpoint[];
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
    /** The reconnection time (in milliseconds) when trying to connect to the event-stream endpoint. */
    readonly retry?: number;
}

/** @internal Options for the event stream channel consumer. */
export interface IEventStreamChannelConsumerOptions {
    /** The channel name pattern the consumer is subscribing to. */
    readonly channelNamePattern: string;
    /** The url endpoint for the event-stream. */
    readonly url: string;
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
    /** The reconnection time (in milliseconds) when trying to connect to the event-stream endpoint. */
    readonly retry?: number;
}

/** @internal Manages event-stream consumers for the module. */
export interface IEventStreamConsumerService {
    /** Adds a consumer using the specified config. */
    addConsumer(config: IEventStreamConsumerConfiguration): void;
    /** Gets a consumer with the specified channel name pattern. */
    getMessageChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined;
}

/** @internal */
export const IEventStreamConsumerService = createService<IEventStreamConsumerService>("express-event-stream-consumer-service");
const defaultRetry = 2000;

/** @internal */
@Singleton
export class EventStreamConsumerService implements IEventStreamConsumerService {
    private configs: IEventStreamConsumerConfiguration[] = [];

    addConsumer(config: IEventStreamConsumerConfiguration): void {
        this.configs.push(config);
    }

    getMessageChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined {
        for (const config of this.configs) {
            for (const endpoint of config.endpoints) {
                if (!endpoint.channelNamePatterns) {
                    return this.createChannelConsumer(channelNamePattern, endpoint, config);
                }
        
                for (const pattern of endpoint.channelNamePatterns) {
                    if (isChannelNameMatch(pattern, channelNamePattern)) {
                        return this.createChannelConsumer(channelNamePattern, endpoint, config);
                    }
                }
            }
        }

        return undefined;
    }

    private createChannelConsumer(channelNamePattern: string, endpoint: IEventStreamEndpoint, config: IEventStreamConsumerConfiguration): IMessageChannelConsumer {
        return new EventStreamChannelConsumer({
            channelNamePattern,
            url: endpoint.url,
            interceptors: config.interceptors,
            retry: config.retry
        });
    }
}

class EventStreamChannelConsumer implements IMessageChannelConsumer {
    constructor(private readonly options: IEventStreamChannelConsumerOptions) {
    }

    subscribe(options: ISubscribeOptions): Promise<ISubscription> {
        const subscription = new Subscription(
            this.options.url, 
            options.subscriptionId,
            this.options.channelNamePattern,
            options.handler, 
            this.options.retry || defaultRetry,
            this.options.interceptors,
            options.logger);

        // don't wait for the subscription to connect because it may fail and trigger
        // an auto-reconnect loop so simply return the subscription after creating it
        return Promise.resolve(subscription);
    }
}

class Subscription implements ISubscription {
    private stream?: IRequestEventStream<IMessage>;
    private closed = false;

    constructor(
        private readonly url: string, 
        private readonly subscriptionId: string,
        private readonly channelNamePattern: string,
        private readonly handler: MessageHandler, 
        private readonly retry: number,
        private readonly interceptors?: IEventStreamInterceptors,
        private readonly logger?: ILogger) {
        this.connect();
    }

    unsubscribe(): void {
        if (this.stream) {
            this.stream.close();
            this.stream = undefined;
        }

        this.closed = true;
    }

    private connect(): void {
        const url = urlJoin(this.url, "?subscriptionId=" + encodeURIComponent(this.subscriptionId) + "&channel=" + encodeURIComponent(this.channelNamePattern));
        
        if (this.logger) {
            this.logger.logDebug({
                name: "event-stream-connect",
                url: this.url,
                channel: this.channelNamePattern, 
                subscriptionId: this.subscriptionId
            });
        }

        this.stream = new RequestEventStream<IMessage>({
            url,
            beforeRequest: this.interceptors && this.interceptors.beforeRequest,
            afterRequest: this.interceptors && this.interceptors.afterRequest,
            validate: (data, resolve, reject) => jsonValidator(
                data,
                obj => { 
                    if (Message.isMessage(obj)) {
                        resolve(obj);
                    }
                    else {
                        // rejecting will cause the onInvalidData event to be raised
                        reject("Invalid data received.");
                    }
                },
                message => reject(message))
        });

        this.stream.onOpen(() => {
            if (this.logger) {
                this.logger.logDebug({
                    name: "event-stream-open",
                    url: this.url,
                    channel: this.channelNamePattern, 
                    subscriptionId: this.subscriptionId
                });
            }
        });

        this.stream.onClose(() => {
            if (this.logger) {
                this.logger.logDebug({
                    name: "event-stream-close",
                    url: this.url,
                    channel: this.channelNamePattern, 
                    subscriptionId: this.subscriptionId
                });
            }
        });

        this.stream.onError(event => {
            setTimeout(() => {
                // auto-reconnect unless the consumer has been unsubscribed
                if (!this.closed) {
                    this.connect();
                }
            }, 
            this.retry);

            if (this.logger) {
                // log the error as an event since we 
                this.logger.logError({
                    name: "event-stream-error",
                    message: "Failed to subscribe to endpoint.",
                    url: this.url,
                    "error.type": event.type,
                    "error.message": event.message
                });
            }
        });

        this.stream.onInvalidData(event => {
            if (this.logger) {
                this.logger.logWarn({
                    name: "event-stream-invalid-data",
                    url: this.url,
                    reason: event.message
                });
            }
        });

        // the 'current' promise will block handling the next message until the previous handler returns
        let current = Promise.resolve();
        this.stream.onMessage(event => current = current.then(() => this.handler(event.data)));
    }
}