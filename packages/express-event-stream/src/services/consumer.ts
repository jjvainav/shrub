import { createService, Transient } from "@shrub/core";
import { IMessage, IMessageChannelConsumer, isChannelNameMatch, ISubscription, Message, MessageHandler } from "@shrub/messaging";
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

/** Defines options for event-stream consumers. */
export interface IEventStreamConsumerOptions {
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
    /** Gets a consumer with the specified channel name pattern and options. */
    getMessageChannelConsumer(channelNamePattern: string, options: IEventStreamConsumerOptions): IMessageChannelConsumer | undefined;
}

/** @internal */
export const IEventStreamConsumerService = createService<IEventStreamConsumerService>("express-event-stream-consumer-service");
const defaultRetry = 2000;

/** @internal */
@Transient
export class EventStreamConsumerService implements IEventStreamConsumerService {
    getMessageChannelConsumer(channelNamePattern: string, options: IEventStreamConsumerOptions): IMessageChannelConsumer | undefined {
        const endpoint = this.findEndpoint(options.endpoints, channelNamePattern);
        if (!endpoint) {
            return undefined;
        }

        return new EventStreamChannelConsumer({
            channelNamePattern,
            url: endpoint.url,
            interceptors: options.interceptors,
            retry: options.retry
        });
    }

    private findEndpoint(endpoints: IEventStreamEndpoint[], channelNamePattern: string): IEventStreamEndpoint | undefined {
        for (const endpoint of endpoints) {
            if (!endpoint.channelNamePatterns) {
                return endpoint;
            }
    
            for (const pattern of endpoint.channelNamePatterns) {
                if (isChannelNameMatch(pattern, channelNamePattern)) {
                    return endpoint;
                }
            }
        }
    
        return undefined;
    }
}

class EventStreamChannelConsumer implements IMessageChannelConsumer {
    constructor(private readonly options: IEventStreamChannelConsumerOptions) {
    }

    subscribe(subscriptionId: string, handler: MessageHandler): Promise<ISubscription> {
        const url = urlJoin(this.options.url, "?subscriptionId=" + encodeURIComponent(subscriptionId) + "&channel=" + encodeURIComponent(this.options.channelNamePattern));
        const subscription = new Subscription(
            url, 
            handler, 
            this.options.retry || defaultRetry,
            this.options.interceptors);

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
        private readonly handler: MessageHandler, 
        private readonly retry: number,
        private readonly interceptors?: IEventStreamInterceptors) {
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
        this.stream = new RequestEventStream<IMessage>({
            url: this.url,
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

        // TODO: telemetry - track open and onClose
        // TODO: the 'telemetry' stuff should be written to a span...


        //this.stream.onOpen(() => {});
        this.stream.onError(event => {
            setTimeout(() => {
                // auto-reconnect unless the consumer has been unsubscribed
                if (!this.closed) {
                    this.connect();
                }
            }, 
            this.retry);
            // TODO: telemetry - track error 
            //reject(new Error(`[${event.type}]: Failed to subscribe to '${url}' with response '${event.message}'`));
        });

        // TODO: telemetry - send invalid data
        //stream.onInvalidData

        // the 'current' promise will block handling the next message until the previous handler returns
        let current = Promise.resolve();
        this.stream.onMessage(event => current = current.then(() => this.handler(event.data)));
    }
}