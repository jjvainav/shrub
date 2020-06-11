import { IMessage } from "@shrub/messaging";
import { EventMessage, IEventMessageHandler, IEventMessage } from "./event";

/** A callback that returns a key for the event message; by default, the event-type is used as a key. */
export interface IEventMessageKeySelector {
    (message: IEventMessage): string;
}

const defaultKeySelector: IEventMessageKeySelector = message => message.metadata[EventMessage.Headers.eventType];

/** Processes event messages from a message channel and routes to registered event handlers based on event type. */
export class EventDispatcher {
    private readonly handlers = new Map<string, IEventMessageHandler[]>();
    private readonly keySelector: IEventMessageKeySelector;

    constructor(keySelector?: IEventMessageKeySelector) {
        this.keySelector = keySelector || defaultKeySelector;
    }

    /** 
     * A message handler that will route event messages to registered event handlers. 
     * When subscribing to a consumer pass this function as the message handler to start processing events.
     */
    async handleMessage(message: IMessage): Promise<void> {
        if (EventMessage.isEventMessage(message)) {
            const handlers = this.handlers.get(this.keySelector(message));
            if (handlers) {
                const promises: Promise<void>[] = [];

                for (const handler of handlers) {
                    promises.push(handler(message));
                }

                await Promise.all(promises);
            }
        }
    }

    /** Registers a callback to handle an event message. */
    registerEventHandler(key: string, handler: IEventMessageHandler): void {
        const handlers = this.handlers.get(key) || [];
        handlers.push(handler);
        this.handlers.set(key, handlers);
    }
}