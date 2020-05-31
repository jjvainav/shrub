import { createRouteDecorator } from "@shrub/express";
import { isChannelNameMatch } from "@shrub/messaging";
import { RequestHandler } from "express";
import { PathParams } from "express-serve-static-core";
import { IEventStreamService } from "./service";

/** 
 * A controller function decorator that will open an event-stream for requesting routes. 
 * IMPORTANT: the stream will not be open unless the function invokes next(); this allows
 * the controller function the ability to perform pre-processing of the request before opening
 * the stream.
 */
export function EventStream(path: PathParams, channelNamePattern: string, ...handlers: RequestHandler[]): (target: any, propertyKey: string) => void {
    return createRouteDecorator(path, { before: handlers, after: [eventStream(channelNamePattern)] }, router => router.get);
}

const eventStream: (channelNamePattern: string) => RequestHandler = channelNamePattern => (req, res, next) => {
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

    req.context.services.get(IEventStreamService).openStream(channelNamePattern, subscriptionId, req, res);
    next();
};