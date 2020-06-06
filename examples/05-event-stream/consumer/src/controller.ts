import { Route } from "@shrub/express";
import { EventStream } from "@shrub/express-event-stream";
import { IMessageConsumer } from "@shrub/messaging";
import createId from "@sprig/unique-id";
import { NextFunction, Request, Response } from "express";

@Route("/api")
export class Controller {
    constructor(@IMessageConsumer private readonly consumer: IMessageConsumer) {
    }

    @EventStream("/messages/bind")
    async openMessageStream(req: Request, res: Response, next: NextFunction): Promise<void> {
        const subscriptionId = <string>req.query.subscriptionId || createId();
        const channel = <string>req.query.channel || "*";

        // subscribe to messages sent from the producer 'server' and pass them down to the browser
        const subscription = await this.consumer.subscribe({
            subscriptionId,
            channelNamePattern: channel,
            handler: message => stream.send(message)
        });

        // write log information to the request span
        subscription.enableLogging(req.context.span!);

        // invoke next to open the stream
        next();

        // the stream won't be available until after next is invoked
        const stream = req.context.eventStream!;
        stream.onClose(() => subscription.unsubscribe());
    }
}