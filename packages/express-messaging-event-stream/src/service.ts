import { createService, Singleton } from "@shrub/core";
import { IMessage, IMessageChannelProducer, isChannelNameMatch, isChannelNamePattern } from "@shrub/messaging";
import { Request, Response } from "express";

/** Manages connected event-stream clients and producers for the module. */
export interface IEventStreamService {
    /** Gets a channel producer with the specified channel name. */
    getMessageChannelProducer(channelName: string): IMessageChannelProducer | undefined;
    /** Gets whether or not a channel with the specified name is supported by the service. */
    isChannelSupported(channelName: string): boolean;
    /** Opens an event-stream consumer for the given request and channel name pattern. */
    openStream(channelNamePattern: string, subscriptionId: string, req: Request, res: Response): void;
    /** Adds the specified channel name pattern to the list of supported channel names; if no channels are whitelisted then all channels will be supported. */
    whitelistChannel(channelNamePattern: string): void;
}

interface IEventStream {
    readonly id: number;
    readonly subscriptionId: string;
    close(): void;
    send(message: IMessage): void;
}

export const IEventStreamService = createService<IEventStreamService>("express-messaging-event-stream-service");

@Singleton
export class EventStreamService implements IEventStreamService {
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

    openStream(channelNamePattern: string, subscriptionId: string, req: Request, res: Response): void {
        res.status(200).set({
            "connection": "keep-alive",
            "content-type": "text/event-stream"
        });

        const stream = this.registerStream(channelNamePattern, subscriptionId, res);

        req.socket.setKeepAlive(true);
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.on("close", () => stream.close());

        res.write(":go\n\n");
    }

    whitelistChannel(channelNamePattern: string): void {
        this.whitelist.add(channelNamePattern);
    }

    private sendMessage(channelName: string, message: IMessage): void {
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

        for (const item of subscriptions.values()) {
            if (item.length === 1) {
                item[0].send(message);
                continue;
            }

            // randomly choose a subscription to send the message too
            const stream = item[Math.floor(Math.random() * item.length)];
            stream.send(message);
        }
    }

    private registerStream(channelNamePattern: string, subscriptionId: string, res: Response): IEventStream {
        const send = (message: IMessage) => res.write(`data: ${JSON.stringify(message)}\n\n`);

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

class ChannelWhitelist {
    private readonly patterns: string[] = [];
    private readonly channels = new Set<string>();
    private allowAll = true;

    add(channelNamePattern: string): void {
        if (isChannelNamePattern(channelNamePattern)) {
            this.patterns.push(channelNamePattern);
        }
        else {
            this.channels.add(channelNamePattern);
        }

        this.allowAll = false;
    }

    isChannelSupported(channelName: string): boolean {
        if (this.allowAll || this.channels.has(channelName)) {
            return true;
        }

        for (const pattern of this.patterns) {
            if (isChannelNameMatch(pattern, channelName)) {
                return true;
            }
        }

        return false;
    }
}