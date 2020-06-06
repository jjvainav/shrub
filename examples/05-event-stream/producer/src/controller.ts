import { Get, Post, Route } from "@shrub/express";
import { EventStream, EventStreamChannel } from "@shrub/express-event-stream";
import { IMessageProducer } from "@shrub/messaging";
import { NextFunction, Request, Response } from "express";

interface IBrowserClient {
    readonly id: number;
    send(metrics: IEventStreamMetrics): void;
}

interface IEventStreamConsumer {
    readonly id: number;
    readonly channel: string;
    readonly subscriptionId: string;
}

interface IEventStreamMetrics {
    readonly consumers: IEventStreamConsumer[];
}

let id = 1;
const clients = new Map<number, IBrowserClient>();
const consumers = new Map<number, IEventStreamConsumer>();

@Route("/api")
export class Controller {
    constructor(@IMessageProducer private readonly producer: IMessageProducer) {
    }

    @EventStream("/consumers/bind")
    openClientStream(req: Request, res: Response, next: NextFunction): void {
        // open a standard event-stream for front-end clients to connect to
        next();

        const client: IBrowserClient = {
            id: id++,
            send: metrics => req.context.eventStream!.send(metrics)
        };        

        clients.set(client.id, client);
        req.context.span!.logInfo({
            name: "browser-connected",
            clientId: client.id
        });

        req.context.eventStream!.onClose(() => {
            clients.delete(client.id);
            req.context.span!.logInfo({
                name: "browser-disconnected",
                clientId: client.id
            });
        });
    }

    @EventStreamChannel("/messages/bind", "*")
    openMessageStreamChannel(req: Request, res: Response, next: NextFunction): void {
        // open an event-stream as a channel in the shrub messaging system used for server-to-server communication
        // if desired, authorize the request now and skip invoking next if the request is not authorized     
        next();

        const consumer: IEventStreamConsumer = {
            id: id++,
            channel: <string>req.query.channel,
            subscriptionId: <string>req.query.subscriptionId
        }

        consumers.set(consumer.id, consumer);

        // send metrics to browsers whenever a consumer has connected or disconnected
        this.sendMetricsToBrowserClients();
        req.on("close", () => {
            consumers.delete(consumer.id);
            this.sendMetricsToBrowserClients();
        });
    }

    @Get("/consumers")
    getConsumers(req: Request, res: Response, next: NextFunction): void {
        res.json(this.getMetrics());
    }

    @Post("/messages")
    postMessage(req: Request, res: Response, next: NextFunction): void {
        const channel = req.body.channel;
        const message = req.body.message;

        this.producer.send(channel, {
            body: { message }
        });

        res.sendStatus(200);
    }

    private getMetrics(): IEventStreamMetrics {
        return { consumers: Array.from(consumers.values()) };
    }

    private sendMetricsToBrowserClients(): void {
        const metrics = this.getMetrics();
        for (const client of clients.values()) {
            client.send(metrics);
        }
    }
}