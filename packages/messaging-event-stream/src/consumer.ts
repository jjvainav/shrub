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
    /** The url endpoint for the event-stream. */
    readonly url: string;
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
}

/** @internal */
export class EventStreamChannelConsumer implements IMessageChannelConsumer {
    private current = Promise.resolve();

    constructor(private readonly options: IEventStreamChannelConsumerOptions) {
    }

    subscribe(subscriberId: string, handler: MessageHandler): ISubscription {
        const stream = new RequestEventStream<IMessage>({
            url: urlJoin(this.options.url, "?subscriberId=" + subscriberId),
            beforeRequest: this.options.interceptors && this.options.interceptors.beforeRequest,
            afterRequest: this.options.interceptors && this.options.interceptors.afterRequest,
            validate: (data, resolve, reject) => jsonValidator(
                data,
                obj => { 
                    if (Message.isMessage(obj)) {
                        resolve(obj);
                    }
                    else {
                        // TODO: what happens on reject?? tie into error reporting mentioned below
                        reject("Invalid data received.");
                    }
                },
                message => reject(message))
        });

        // TODO: handle if a connection failed
        //stream.onError
        
        stream.onMessage(event => {

            // TODO: suport for handling invalid messages? pass in an Invalid Message channel/producer into the constructor?
            // the 'current' promise will block handling the next message until the previous handler returns
            this.current = this.current.then(() => handler(event.data));
        });

        return { unsubscribe: () => stream.close() };
    }
}
