import { Get, Post, Route } from "@shrub/express";
import { EventStream, EventStreamChannel, IEventStreamMetrics, IEventStreamMetricsService } from "@shrub/express-event-stream";
import { IMessageProducer } from "@shrub/messaging";
import { NextFunction, Request, Response } from "express";

interface IBrowserClient {
    readonly id: number;
    send(metrics: IEventStreamMetrics): void;
}

let clientId = 1;
const clients = new Map<number, IBrowserClient>();

@Route("/api")
export class Controller {
    constructor(
        @IEventStreamMetricsService private readonly metrics: IEventStreamMetricsService,
        @IMessageProducer private readonly producer: IMessageProducer) {
    }

    @Get("/consumers/bind")
    openClientStream(req: Request, res: Response, next: NextFunction): void {
        // it would be possible to use the EventStream to send messages to the browser client
        // but for this demo it is only used to demonstrate sending messages between the
        // consumer and producer servers

        res.status(200).set({
            "connection": "keep-alive",
            "cache-control": "no-cache",
            "content-type": "text/event-stream"
        });
    
        const client: IBrowserClient = {
            id: clientId++,
            send: metrics => res.write(`data: ${JSON.stringify(metrics)}\n\n`)
        };
    
        clients.set(client.id, client);
        console.log("Browser connected:", client.id);
        req.context.span!.logInfo({
            name: "browser-connected",
            props: { clientId: client.id } 
        });
    
        req.socket.setKeepAlive(true);
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.on("close", () => {
            clients.delete(client.id);
            req.context.span!.logInfo({
                name: "browser-disconnected",
                props: { clientId: client.id }
            });
        });
    
        res.write(":go\n\n");
    }

    @EventStreamChannel("/messages/bind", "*")
    openMessageStreamChannel(req: Request, res: Response, next: NextFunction): void {
        // consumers from the consumer service will connect/subscribe via this endpoint
        // if desired, authorize the request now and skip invoking next if the request is not authorized     
        next();

        const subscriptionId = <string>req.query.subscriptionId;
        const channel = <string>req.query.channel;

        req.context.span!.logInfo({
            name: "consumer-connected",
            props: { channel, subscriptionId } 
        });

        // send metrics to browsers whenever a consumer has connected or disconnected
        this.sendMetricsToBrowserClients();
        req.on("close", () => {
            this.sendMetricsToBrowserClients();
            req.context.span!.logInfo({
                name: "consumer-disconnected",
                props: { channel, subscriptionId } 
            });
        });
    }

    @Get("/consumers")
    getConsumers(req: Request, res: Response, next: NextFunction): void {
        res.json(this.metrics.getMetrics());
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

    private sendMetricsToBrowserClients(): void {
        const metrics = this.metrics.getMetrics();
        for (const client of clients.values()) {
            client.send(metrics);
        }
    }
}