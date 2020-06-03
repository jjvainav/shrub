import { createRouteDecorator } from "@shrub/express";
import { isChannelNameMatch } from "@shrub/messaging";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { RequestHandler } from "express";
import { PathParams } from "express-serve-static-core";
import { IEventStreamProducerService } from "./services/producer";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        /** Provides access to an event-stream for routes that open streams to a client. */
        readonly eventStream?: IEventStream;
    }
}

/** Provides access to the currently opened event stream. */
export interface IEventStream {
    /** Raised when the event stream has closed. */
    readonly onClose: IEvent;
    /** Sends data to the current stream. */
    send(data: any): void;
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
    return createRouteDecorator(path, { before: handlers, after: [eventStream] }, router => router.get);
}

/** 
 * A controller function decorator that will open an event-stream messaging channel for requesting routes
 * and is the endpoint for event-stream messaging consumers.
 * 
 * IMPORTANT: the stream will not be open unless the function invokes next(); this allows
 * the controller function the ability to perform pre-processing of the request before opening
 * the stream.
 */
export function EventStreamChannel(path: PathParams, channelNamePattern: string, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path, { before: handlers, after: [eventStreamChannel(channelNamePattern)] }, router => router.get);
}

const eventStream: RequestHandler = (req, res, next) => {
    res.status(200).set({
        "connection": "keep-alive",
        "cache-control": "no-cache",
        "content-type": "text/event-stream"
    });

    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);

    const close = new EventEmitter("event-stream-close");
    const eventStream: IEventStream = {
        onClose: close.event,
        send: data => res.write(`data: ${JSON.stringify(data)}\n\n`)
    };

    (<any>req.context).eventStream = eventStream;

    req.on("close", () => close.emit());

    res.write(":go\n\n");
    next();
};

const eventStreamChannel: (channelNamePattern: string) => RequestHandler = channelNamePattern => (req, res, next) => {
    const channel = req.query.channel;
    const subscriptionId = req.query.subscriptionId;

    if (typeof channel !== "string") {
        res.status(400).json({ message: "Missing or invalid channel parameter." });
        return;
    }

    if (typeof subscriptionId !== "string") {
        res.status(400).json({ message: "Missing or invalid subscriptionId parameter." });
        return;
    }

    if (!isChannelNameMatch(channelNamePattern, channel)) {
        res.status(400).json({ message: "Invalid channel name." });
        return;
    }

    req.context.services.get(IEventStreamProducerService).openStream(channel, subscriptionId, req, res);
    next();
};