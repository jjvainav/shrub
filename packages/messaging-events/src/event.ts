import { IMessage, MessageMetadata } from "@shrub/messaging";

/** Defines required and known metadata for an event. */
export type EventMessageMetadata = MessageMetadata & {
    readonly "event-type": string;
};

/** Defines required and known metadata for an entity event. */
export type EntityEventMessageMetadata = EventMessageMetadata & {
    readonly "entity-id": string;
    readonly "entity-type": string;
};

/** Defines a message for an event. */
export interface IEventMessage extends IMessage {
    readonly metadata: EventMessageMetadata;
}

/** Defines a message representing an event against a specific entity. */
export interface IEntityEventMessage extends IEventMessage {
    readonly metadata: EntityEventMessageMetadata;
}

/** Defines a handler for an event message. */
export interface IEventMessageHandler<TEventMessage extends IEventMessage = IEventMessage> {
    (message: TEventMessage): Promise<void>;
}

/** A callback that returns a key for an event message. */
export interface IEventMessageKeySelector<TEventMessage extends IEventMessage = IEventMessage> {
    (message: TEventMessage): string;
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
    }

    export function isEventMessage(message: IMessage): message is IEventMessage {
        return message.metadata[Metadata.eventType] !== undefined;
    }
}

export namespace EntityEventMessage {
    /** Defines common metadata for an event message. */
    export namespace Metadata {
        /** The id of the entity the event is associated with. */
        export const entityId = "entity-id";
        /** The type of entity the event is associated with. */
        export const entityType = "entity-type";
    }

    export function isEntityEventMessage(message: IMessage): message is IEntityEventMessage {
        return message.metadata[Metadata.entityId] !== undefined;
    }
}

/** A utility class that will handle routing messages to event message handlers based on a routing key. */
export class EventMessageRouter<TEventMessage extends IEventMessage = IEventMessage> {
    private readonly handlers = new Map<string, Set<IEventMessageHandler<TEventMessage>>>();

    constructor(private readonly keySelector: IEventMessageKeySelector<TEventMessage>) {
    }

    addRoute(key: string, handler: IEventMessageHandler<TEventMessage>): IEventMessageRoute {
        let handlers = this.handlers.get(key);

        if (!handlers) {
            handlers = new Set<IEventMessageHandler<TEventMessage>>();
            this.handlers.set(key, handlers);
        }

        handlers.add(handler);
        return { remove: () => this.removeHandler(key, handler) };
    }

    async handle(message: TEventMessage): Promise<void> {
        const handlers = this.handlers.get(this.keySelector(message));

        if (handlers) {
            const promises: Promise<void>[] = [];
            for (const handler of handlers) {
                promises.push(handler(message));
            }

            await Promise.all(promises);
        }
    }

    private removeHandler(key: string, handler: IEventMessageHandler<TEventMessage>): void {
        const handlers = this.handlers.get(key);
        // delete the handler and delete the handler set if empty
        if (handlers && handlers.delete(handler) && handlers.size === 0) {
            this.handlers.delete(key);
        }
    }
}