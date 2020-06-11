import { IMessage } from "@shrub/messaging";
import { EventMessage, EventMessageRouter, IEventMessageHandler, IEventMessageKeySelector, IEventMessageRoute } from "./event";

const eventTypeKeySelector: IEventMessageKeySelector = message => message.metadata[EventMessage.Headers.eventType];

/** Processes event messages from a message channel and routes to registered event handlers based on a routing key; the default is to route by event-type. */
export class EventDispatcher {
    private readonly router: EventMessageRouter;

    constructor(keySelector?: IEventMessageKeySelector) {
        this.router = new EventMessageRouter(keySelector || eventTypeKeySelector);
    }

    /** 
     * A message handler that will route event messages to registered event handlers. 
     * When subscribing to a consumer pass this function as the message handler to start processing events.
     */
    handleMessage(message: IMessage): Promise<void> {
        if (EventMessage.isEventMessage(message)) {
            return this.router.handle(message);
        }

        return Promise.resolve();
    }

    /** Registers a callback to handle an event message; the message will be routed based on the dispatcher's key selector. */
    registerEventHandler(key: string, handler: IEventMessageHandler): IEventMessageRoute {
        return this.router.addRoute(key, handler);
    }
}