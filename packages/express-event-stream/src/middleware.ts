import { createRouteDecorator } from "@shrub/express";
import { isChannelNameMatch } from "@shrub/messaging";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { Request, RequestHandler, Response } from "express";
import { PathParams } from "express-serve-static-core";
import { IEventStreamMessageFilter, IEventStreamProducerService } from "./services/producer";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        /** Provides access to an event-stream for routes that open streams to a client using the EventStream decorator. */
        eventStream?: IEventStream;
        /** Provides access to the event-stream channel for messaging consumers subscribed to endpoints using the EventStreamChannel decorator. */
        eventStreamChannel?: IEventStreamChannel;
    }
}

/** Provides access to the currently opened event stream. */
export interface IEventStream {
    /** Raised when the event stream has closed. */
    readonly onClose: IEvent;
    /** Raised when the event stream has opened. */
    readonly onOpen: IEvent;
    /** Gets whether or not the event-stream is currently open. */
    isOpen(): boolean;
    /** Opens the event stream. */
    open(): void;
    /** Sends data to the current stream. */
    send(data: any): void;
}

/** Provides access to the subscribed consumer channel. */
export interface IEventStreamChannel {
    /** Raised when the consumer has unsubscribed and the event-stream has closed. */
    readonly onClose: IEvent;
    /** Raised when the consumer has subscribed. */
    readonly onOpen: IEvent;
    /** The channel name pattern the consumer subscribed to. */
    readonly channelNamePattern: string;
    /** The consumer's subscription id. */
    readonly subscriptionId: string;
    /** Gets whether or not the event-stream is currently open. */
    isOpen(): boolean;
    /** Subscribe to the consumer channel. */
    open(): void;
}

/** A callback for building a producer channel pattern for a given request. */
export interface IEventStreamChannelPatternBuilder {
    (req: Request): string;
}

/** Defines options for the EventStreamChannel decorator. */
export interface IEventStreamChannelOptions {
    /** A channel name pattern builder used to build producer channel pattern names for a given request. */
    readonly builder?: IEventStreamChannelPatternBuilder;
    /** A channel name pattern to restrict what channels consumers of the endpoint can subscribe to; the default is '*'. */
    readonly pattern?: string;
    /** A set of request handlers to execute before the event-stream request handler. */
    readonly handlers?: RequestHandler[];
}

/** 
 * A controller function decorator that will open an event-stream with the requesting client. The server
 * can interact with the client via the req.context.eventStream objects that will be injected for the route.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next() or invokes req.context.eventStream.open(); 
 * this allows the controller function the ability to perform pre-processing of the request before opening the stream.
 */
export function EventStream(path: PathParams, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator((router, handler) => router.get(path, ...handlers, (req, res, next) => {
        const eventStream = new EventStreamImplementation(req, res);
        req.context.eventStream = eventStream;

        handler(req, res, (err?: any) => {
            if (!err && !eventStream.isOpen()) {
                eventStream.open();
            }

            if (err) {
                // only invoke next if there is an error
                next(err);
            }
        });
    }));
}

/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers. The optional builder parameter allows building
 * a producer channel pattern from a given request; this is useful when a url has parameters and the 
 * producer channel needs to be associated with these parameters.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next() or invokes req.context.eventStreamChannel.open(); this allows
 * the controller function the ability to perform pre-processing of the request before opening the stream.
 */
export function EventStreamChannel(path: PathParams, builder?: IEventStreamChannelPatternBuilder, filter?: IEventStreamMessageFilter): (target: any, propertyKey: string) => void;
/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers. The endpoint the EventStreamChannel is
 * associated with will expect 2 query parameters: subscriptionId - a subscription id for the consumer and
 * channel - the name of the channel to subscribe to and is expected to match the channel pattern 
 * defined by the EventStreamChannel.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next() or invokes req.context.eventStreamChannel.open(); this allows
 * the controller function the ability to perform pre-processing of the request before opening the stream.
 */
export function EventStreamChannel(path: PathParams, options?: IEventStreamChannelOptions, filter?: IEventStreamMessageFilter): (target: any, propertyKey: string) => void;
/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers. The producerChannelPattern defines the channels
 * the endpoint will allow consumers to subscribe to; the default is "*".
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next() or invokes req.context.eventStreamChannel.open(); this allows
 * the controller function the ability to perform pre-processing of the request before opening the stream.
 */
export function EventStreamChannel(path: PathParams, producerChannelPattern?: string, filter?: IEventStreamMessageFilter): (target: any, propertyKey: string) => void;
export function EventStreamChannel(path: PathParams, arg?: IEventStreamChannelPatternBuilder | IEventStreamChannelOptions | string, filter?: IEventStreamMessageFilter): (target: any, propertyKey: string) => void {
    const options = toEventStreamChannelOptions(arg);
    const handlers = options.handlers || [];

    return createRouteDecorator((router, handler) => router.get(path, ...handlers, (req, res, next) => {
        const pattern = options.builder ? options.builder(req) : options.pattern;
        validateConsumerParams(pattern, req, res, (channel, subscriptionId) => {
            const eventStreamChannel = new EventStreamChannelImplementation(req.context.services.get(IEventStreamProducerService), req, res, channel, subscriptionId, filter);
            req.context.eventStreamChannel = eventStreamChannel;
            
            handler(req, res, (err?: any) => {
                if (!err && !eventStreamChannel.isOpen()) {
                    eventStreamChannel.open();
                }
    
                if (err) {
                    // only invoke next if there is an error
                    next(err);
                }
            });
        });
    }));
}

function toEventStreamChannelOptions(arg?: IEventStreamChannelPatternBuilder | IEventStreamChannelOptions | string): IEventStreamChannelOptions {
    return typeof arg === "function"
        ? { builder: arg }
        : typeof arg === "string" ? { pattern: arg } : arg || {};
}

/** @internal */
export const validateConsumerParams: (producerChannelPattern: string | undefined, req: Request, res: Response, onValid: (channel: string, subscriptionId: string) => void) => void = (producerChannelPattern, req, res, onValid) => {
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

class EventStreamImplementation implements IEventStream {
    private readonly _close = new EventEmitter("event-stream-close");
    private readonly _open = new EventEmitter("event-stream-open");
    private pending: any[] = [];
    private _isOpen = false;

    constructor(
        private readonly req: Request, 
        private readonly res: Response) {
    }

    get onClose(): IEvent {
        return this._close.event;
    }

    get onOpen(): IEvent {
        return this._open.event;
    }

    isOpen(): boolean {
        return this._isOpen;
    }

    open(): void {
        if (!this._isOpen) {
            this.res.status(200).set({
                "connection": "keep-alive",
                "cache-control": "no-cache",
                "content-type": "text/event-stream"
            });
        
            this.req.socket.setKeepAlive(true);
            this.req.socket.setNoDelay(true);
            this.req.socket.setTimeout(0);

            this.req.on("close", () => {
                this._isOpen = false;
                this._close.emit();
            });
            
            this.res.write(":go\n\n");

            this._isOpen = true;
            this._open.emit();

            this.pending.forEach(data => this.send(data));
            this.pending.splice(0);
        }
    }

    send(data: any): void {
        if (this._isOpen) {
            this.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        else {
            this.pending.push(data);
        }
    }
}

class EventStreamChannelImplementation implements IEventStreamChannel {
    private readonly _close = new EventEmitter("event-stream-close");
    private readonly _open = new EventEmitter("event-stream-open");
    private _isOpen = false;

    constructor(
        private readonly service: IEventStreamProducerService,
        private readonly req: Request, 
        private readonly res: Response,
        readonly channelNamePattern: string,
        readonly subscriptionId: string,
        readonly filter?: IEventStreamMessageFilter) {
    }

    get onClose(): IEvent {
        return this._close.event;
    }

    get onOpen(): IEvent {
        return this._open.event;
    }

    isOpen(): boolean {
        return this._isOpen;
    }

    open(): void {
        if (!this._isOpen) {
            const connection = this.service.openStream(this.channelNamePattern, this.subscriptionId, this.req, this.res, this.filter);
            connection.onClose(() => {
                this._isOpen = false;
                this._close.emit();
            });

            this._isOpen = true;
            this._open.emit();
        }
    }
}