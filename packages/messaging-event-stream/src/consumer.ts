import { IMessage, IMessageChannelConsumer, ISubscription, Message, MessageHandler } from "@shrub/messaging";
import { IRequest, IRequestPromise } from "@sprig/request-client";
import { jsonValidator, RequestEventStream } from "@sprig/request-client-events";
import urlJoin from "url-join";

/** Interceptors that get passed to the underlying RequestEventStream. */
export interface IEventStreamInterceptors {
    readonly beforeRequest?: (request: IRequest) => IRequest;
    readonly afterRequest?: (promise: IRequestPromise) => IRequestPromise;
}

/** Options for the event stream channel consumer. */
/** @internal */
export interface IEventStreamChannelConsumerOptions {
    /** The channel name pattern the consumer is subscribing to. */
    readonly channelNamePattern: string;
    /** The url endpoint for the event-stream. */
    readonly url: string;
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
}

/** @internal */
export class EventStreamChannelConsumer implements IMessageChannelConsumer {
    constructor(private readonly options: IEventStreamChannelConsumerOptions) {
    }

    subscribe(subscriptionId: string, handler: MessageHandler): Promise<ISubscription> {
        return new Promise((resolve, reject) => {
            let current = Promise.resolve();
            const url = urlJoin(this.options.url, "?subscriptionId=" + encodeURIComponent(subscriptionId) + "&channel=" + encodeURIComponent(this.options.channelNamePattern));
            const stream = new RequestEventStream<IMessage>({
                url,
                beforeRequest: this.options.interceptors && this.options.interceptors.beforeRequest,
                afterRequest: this.options.interceptors && this.options.interceptors.afterRequest,
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
            // TODO: telemetry - track error 

            stream.onOpen(() => resolve({ unsubscribe: () => stream.close() }));
            stream.onError(event => {
                reject(new Error(`[${event.type}]: Failed to subscribe to '${url}' with response '${event.message}'`));
            });

            // TODO: telemetry - send invalid data
            //stream.onInvalidData
            
            // the 'current' promise will block handling the next message until the previous handler returns
            stream.onMessage(event => current = current.then(() => handler(event.data)));
        });
    }
}
