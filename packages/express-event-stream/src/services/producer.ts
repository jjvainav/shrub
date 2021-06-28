import { createService, Singleton } from "@shrub/core";
import { ChannelWhitelist, IMessage, IMessageChannelProducer, IMessageDetails, isChannelNameMatch, isChannelNamePattern } from "@shrub/messaging";
import { ISpan } from "@shrub/tracing";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import createId from "@sprig/unique-id";
import { Request, Response } from "express";

/** @internal Manages event-stream producers for the module. */
export interface IEventStreamProducerService {
    /** Gets a channel producer with the specified channel name. */
    getMessageChannelProducer(channelName: string): IMessageChannelProducer | undefined;
    /** Gets whether or not a channel with the specified name is supported by the service. */
    isChannelSupported(channelName: string): boolean;
    /** Opens an event-stream for a consumer given the consumer's request and a channel name pattern. */
    openStream(channelNamePattern: string, subscriptionId: string, req: Request, res: Response, filter?: IEventStreamMessageFilter): IEventStreamConsumerConnection;
    /** Adds the specified channel name pattern to the list of supported channel names; if no channels are whitelisted then all channels will be supported. */
    whitelistChannel(channelNamePattern: string): void;
}

/** @internal Represents an event-stream connection for a consumer. */
export interface IEventStreamConsumerConnection {
    readonly onClose: IEvent;
}

/** @internal An envelope for a message that is sent over a stream to a consumers. */
export interface IMessageEnvelope {
    readonly ch: string;
    readonly msg: IMessage;
}

/** 
 * A callback that allows filtering messages over an event stream channel; if the callback returns true, the message 
 * will be sent over the stream to registered consumers, but if the callback returns false, the message will not be sent.
 */
 export interface IEventStreamMessageFilter {
    (message: IMessage): boolean;
}

interface IEventStream {
    readonly id: number;
    readonly subscriptionId: string;
    close(): void;
    send(envelope: IMessageEnvelope): void;
}

/** @internal */
export const IEventStreamProducerService = createService<IEventStreamProducerService>("express-event-stream-producer-service");

/** @internal */
@Singleton
export class EventStreamProducerService implements IEventStreamProducerService {
    private readonly patterns = new Map<number, [string, IEventStream]>();
    private readonly streams = new Map<string, Map<number, IEventStream>>();
    private readonly whitelist = new ChannelWhitelist();
    private nextId = 1;

    getMessageChannelProducer(channelName: string): IMessageChannelProducer | undefined {
        return this.whitelist.isChannelSupported(channelName) 
            ? { send: message => this.sendMessage(channelName, message) }
            : undefined;
    }

    isChannelSupported(channelName: string): boolean {
        return this.whitelist.isChannelSupported(channelName);
    }

    openStream(channelNamePattern: string, subscriptionId: string, req: Request, res: Response, filter?: IEventStreamMessageFilter): IEventStreamConsumerConnection {
        res.status(200).set({
            "connection": "keep-alive",
            "content-type": "text/event-stream"
        });

        const span = <ISpan | undefined>(<any>req.context).span;
        const stream = this.registerStream(channelNamePattern, subscriptionId, res);
        const close = new EventEmitter("event-stream-close");

        req.socket.setKeepAlive(true);
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.on("close", () => {
            stream.close();
            if (span) {
                span.logInfo({
                    name: "event-stream-consumer-disconnected",
                    channel: channelNamePattern,
                    subscriptionId
                });
            }
            
            close.emit();
        });

        if (span) {
            span.logInfo({
                name: "event-stream-consumer-connected",
                channel: channelNamePattern,
                subscriptionId
            });
        }

        res.write(":go\n\n");

        return { onClose: close.event };
    }

    whitelistChannel(channelNamePattern: string): void {
        this.whitelist.add(channelNamePattern);
    }

    private sendMessage(channelName: string, details: IMessageDetails): void {
        const message: IMessage = {
            id: createId(),
            metadata: details.metadata || {},
            data: details.data
        };
        const subscriptions = new Map<string, IEventStream[]>();
        const add = (stream: IEventStream) => {
            const streams = subscriptions.get(stream.subscriptionId) || [];
            subscriptions.set(stream.subscriptionId, streams);
            streams.push(stream);
        }

        const items = this.streams.get(channelName);
        if (items) {
            for (const stream of items.values()) {
                add(stream);
            }
        }

        for (const item of this.patterns.values()) {
            if (isChannelNameMatch(item[0], channelName)) {
                add(item[1]);
            }
        }

        // send the channel name to the subscriber incase they are subscribing using a pattern
        const envelope: IMessageEnvelope = { msg: message, ch: channelName };
        for (const item of subscriptions.values()) {
            if (item.length === 1) {
                item[0].send(envelope);
                continue;
            }

            // randomly choose a subscription to send the message too
            const stream = item[Math.floor(Math.random() * item.length)];
            stream.send(envelope);
        }
    }

    private registerStream(channelNamePattern: string, subscriptionId: string, res: Response, filter?: IEventStreamMessageFilter): IEventStream {
        const send = (envelope: IMessageEnvelope) => {
            if (!filter || filter(envelope.msg)) {
                res.write(`data: ${JSON.stringify(envelope)}\n\n`);
            }
        }

        if (isChannelNamePattern(channelNamePattern)) {
            const id = this.nextId++;
            const stream: IEventStream = { id, subscriptionId, send, close: () => this.patterns.delete(id) };
            this.patterns.set(id, [channelNamePattern, stream]);
            return stream;
        }
        
        let items = this.streams.get(channelNamePattern);
        if (!items) {
            items = new Map<number, IEventStream>();
            this.streams.set(channelNamePattern, items);
        }

        const id = this.nextId++;
        const stream: IEventStream = {
            id,
            subscriptionId,
            send,
            close: () => {
                const items = this.streams.get(channelNamePattern);

                if (items) {
                    items.delete(stream.id);
                }
            }
        };

        items.set(stream.id, stream);

        return stream;
    }
}