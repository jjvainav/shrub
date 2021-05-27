import { IMessage, MessageMetadata } from "@shrub/messaging";

/** Defines required and known metadata for an event. */
export type EventMessageMetadata = MessageMetadata & {
    readonly "event-type": string;
    readonly "resource-id": string;
    readonly "resource-type": string;
    readonly "child-resource-id"?: string;
    readonly "child-resource-type"?: string;
};

/** Defines a message representing an event against a specific resource. */
export interface IEventMessage extends IMessage {
    readonly metadata: EventMessageMetadata;
}

/** Defines a handler for an event message. */
export interface IEventMessageHandler {
    (message: IEventMessage): Promise<void>;
}

/** A callback that returns a key for an event message. */
export interface IEventMessageKeySelector {
    (message: IEventMessage): string;
}

/** Represents a registered route for a router. */
export interface IEventMessageRoute {
    /** Remove the route from the router. */
    remove(): void;
}

export namespace EventMessage {
    /** Defines common metadata for an event message. */
    export namespace Metadata {
        /** The type of event. */
        export const eventType = "event-type";
        /** The id of the resource the event is associated with. */
        export const resourceId = "resource-id";
        /** The type of resource the event is associated with. */
        export const resourceType = "resource-type";
    }

    export function isEventMessage(message: IMessage): message is IEventMessage {
        return message.metadata[Metadata.eventType] !== undefined;
    }
}

/** A utility class that will handle routing messages to event message handlers based on a routing key. */
export class EventMessageRouter {
    private readonly handlers = new Map<string, Set<IEventMessageHandler>>();

    constructor(private readonly keySelector: IEventMessageKeySelector) {
    }

    addRoute(key: string, handler: IEventMessageHandler): IEventMessageRoute {
        let handlers = this.handlers.get(key);

        if (!handlers) {
            handlers = new Set<IEventMessageHandler>();
            this.handlers.set(key, handlers);
        }

        handlers.add(handler);
        return { remove: () => this.removeHandler(key, handler) };
    }

    async handle(message: IEventMessage): Promise<void> {
        const handlers = this.handlers.get(this.keySelector(message));

        if (handlers) {
            const promises: Promise<void>[] = [];
            for (const handler of handlers) {
                promises.push(handler(message));
            }

            await Promise.all(promises);
        }
    }

    private removeHandler(key: string, handler: IEventMessageHandler): void {
        const handlers = this.handlers.get(key);
        // delete the handler and delete the handler set if empty
        if (handlers && handlers.delete(handler) && handlers.size === 0) {
            this.handlers.delete(key);
        }
    }
}