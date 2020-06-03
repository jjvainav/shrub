import { Get, Route } from "@shrub/express";
import { IMessageConsumer } from "@shrub/messaging";
import createId from "@sprig/unique-id";
import { NextFunction, Request, Response } from "express";

@Route("/api")
export class Controller {
    constructor(@IMessageConsumer private readonly consumer: IMessageConsumer) {
    }

    @Get("/messages/bind")
    async openMessageStream(req: Request, res: Response, next: NextFunction): Promise<void> {
        const subscriptionId = <string>req.query.subscriptionId || createId();
        const channel = <string>req.query.channel || "*";

        // subscribe to messages sent from the producer 'server'
        // and pass them down to the browser
        const subscription = await this.consumer.subscribe({
            subscriptionId,
            channelNamePattern: channel,
            handler: message => { 
                res.write(`data: ${JSON.stringify(message)}\n\n`);
            }
        });

        req.context.span!.logInfo({
            name: "connection-open",
            props: { channel, subscriptionId } 
        });

        res.status(200).set({
            "connection": "keep-alive",
            "cache-control": "no-cache",
            "content-type": "text/event-stream"
        });

        req.socket.setKeepAlive(true);
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.on("close", () => {
            subscription.unsubscribe();
            req.context.span!.logInfo({
                name: "connection-closed",
                props: { channel, subscriptionId } 
            });
        });
    
        res.write(":go\n\n");
    }
}