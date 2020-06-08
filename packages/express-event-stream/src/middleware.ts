import { createRouteDecorator, IRouteInterceptors } from "@shrub/express";
import { isChannelNameMatch } from "@shrub/messaging";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { Request, RequestHandler, Response } from "express";
import { PathParams } from "express-serve-static-core";
import { IEventStreamProducerService } from "./services/producer";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        /** Provides access to an event-stream for routes that open streams to a client using the EventStream decorator. */
        readonly eventStream?: IEventStream;
        /** Provides access to the event-stream channel for messaging consumers subscribed to endpoints using the EventStreamChannel decorator. */
        readonly eventStreamChannel?: IEventStreamChannel;
    }
}

/** Provides access to the currently opened event stream. */
export interface IEventStream {
    /** Raised when the event stream has closed. */
    readonly onClose: IEvent;
    /** Sends data to the current stream. */
    send(data: any): void;
}

/** Provides access to the subscribed consumer channel. */
export interface IEventStreamChannel {
    /** Raised when the consumer has unsubscribed and the event-stream has closed. */
    readonly onClose: IEvent;
    /** The channel name pattern the consumer subscribed to. */
    readonly channelNamePattern: string;
    /** The consumer's subscription id. */
    readonly subscriptionId: string;
    /** Gets whether or not the event-stream is currently open. */
    isOpen(): boolean;
}

/** Defines options for the EventStreamChannel decorator. */
export interface IEventStreamChannelOptions {
    /** A channel name pattern to restrict what channels consumers of the endpoint can subscribe to; the default is '*'. */
    readonly producerChannelPattern?: string;
    /** A set of request handlers to execute before the event-stream request handler. */
    readonly handlers?: RequestHandler[];
}

/** 
 * A controller function decorator that will open an event-stream with the requesting client. The server
 * can interact with the client via the req.context.eventStream objects that will be injected for the route.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next(); this allows
 * the controller function the ability to perform pre-processing of the request before opening
 * the stream. This also means req.context.eventStream won't be accessable until after next() has been invoked.
 */
export function EventStream(path: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    const interceptors: IRouteInterceptors = {
        before: handlers ? [initializeEventStream, ...handlers] : [initializeEventStream],
        after: [openEventStream]
    };

    return createRouteDecorator(path, interceptors, router => router.get);
}

/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next(); this allows
 * the controller function the ability to perform pre-processing of the request before opening
 * the stream.
 */
export function EventStreamChannel(path: PathParams, options?: IEventStreamChannelOptions): (target: any, propertyKey: string) => void;
/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers. The producerChannelPattern defines the channels
 * the endpoint will allow consumers to subscribe to; the default is "*".
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next(); this allows
 * the controller function the ability to perform pre-processing of the request before opening
 * the stream.
 */
export function EventStreamChannel(path: PathParams, producerChannelPattern?: string): (target: any, propertyKey: string) => void;
export function EventStreamChannel(path: PathParams, optionsOrProducerChannelPattern?: IEventStreamChannelOptions | string): (target: any, propertyKey: string) => void {
    const options = typeof optionsOrProducerChannelPattern === "string" ? { producerChannelPattern: optionsOrProducerChannelPattern } : optionsOrProducerChannelPattern;
    const interceptors: IRouteInterceptors = {
        before: options && options.handlers ? [initializeEventStreamChannel(options), ...options.handlers] : [initializeEventStreamChannel(options)],
        after: [openEventStreamChannel]
    };

    return createRouteDecorator(path, interceptors, router => router.get);
}

/** @internal */
export const validateConsumerParams: (producerChannelPattern: string | undefined, onValid: (channel: string, subscriptionId: string) => void) => RequestHandler = (producerChannelPattern, onValid) => (req, res, next) => {
    const channel = req.query.channel;
    const subscriptionId = req.query.subscriptionId;

    if (typeof channel !== "string") {
        res.status(400).json({ message: "Missing or invalid channel query parameter." });
        return;
    }

    if (typeof subscriptionId !== "string") {
        res.status(400).json({ message: "Missing or invalid subscriptionId query parameter." });
        return;
    }

    if (producerChannelPattern) {
        if (!isChannelNameMatch(producerChannelPattern, channel)) {
            res.status(400).json({ message: `Invalid consumer channel (${channel}), name is not supported by this endpoint.` });
            return;
        }
    }

    onValid(channel, subscriptionId);
};

const initializeEventStream: RequestHandler = (req, res, next) => {
    (<any>req.context).eventStream = new EventStreamImplementation(req, res);
    next();
};

const openEventStream: RequestHandler = (req, res, next) => {
    res.status(200).set({
        "connection": "keep-alive",
        "cache-control": "no-cache",
        "content-type": "text/event-stream"
    });

    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);

    res.write(":go\n\n");

    (<EventStreamImplementation>req.context.eventStream).onOpened();

    next();
};

const initializeEventStreamChannel: (options?: IEventStreamChannelOptions) => RequestHandler = options => (req, res, next) => {
    validateConsumerParams(options && options.producerChannelPattern, (channel, subscriptionId) => {
        (<any>req.context).eventStreamChannel = new EventStreamChannelImplementation(req.context.services.get(IEventStreamProducerService), channel, subscriptionId);
        next();
    });
};

const openEventStreamChannel: RequestHandler = (req, res, next) => {
    (<EventStreamChannelImplementation>req.context.eventStreamChannel).open(req, res);
    next();
};

class EventStreamImplementation implements IEventStream {
    private readonly close = new EventEmitter("event-stream-close");
    private pending: any[] = [];
    private isOpen = false;

    constructor(
        private readonly req: Request, 
        private readonly res: Response) {
    }

    get onClose(): IEvent {
        return this.close.event;
    }

    send(data: any): void {
        if (this.isOpen) {
            this.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        else {
            this.pending.push(data);
        }
    }

    onOpened(): void {
        if (!this.isOpen) {
            this.req.on("close", () => this.close.emit());
            this.isOpen = true;

            this.pending.forEach(data => this.send(data));
            this.pending.splice(0);
        }
    }
}

class EventStreamChannelImplementation implements IEventStreamChannel {
    private readonly close = new EventEmitter("event-stream-close");
    private _isOpen = false;

    constructor(
        private readonly service: IEventStreamProducerService,
        readonly channelNamePattern: string,
        readonly subscriptionId: string) {
    }

    get onClose(): IEvent {
        return this.close.event;
    }

    isOpen(): boolean {
        return this._isOpen;
    }

    open(req: Request, res: Response): void {
        if (!this._isOpen) {
            const connection = this.service.openStream(this.channelNamePattern, this.subscriptionId, req, res);
            connection.onClose(() => {
                this._isOpen = false;
                this.close.emit();
            });

            this._isOpen = true;
        }
    }
}