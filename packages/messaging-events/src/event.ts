import { IMessage, MessageMetadata } from "@shrub/messaging";

/** Defines required metadata for an event. */
export type EventMessageMetadata = MessageMetadata & {
    readonly "event-type": string;
    readonly "resource-id": string;
    readonly "resource-type": string;
};

/** Defines a message representing an event against a specific resource. */
export interface IEventMessage extends IMessage {
    readonly metadata: EventMessageMetadata;
}

/** Defines a handler for an event message. */
export interface IEventMessageHandler {
    (message: IEventMessage): Promise<void>;
}

export namespace EventMessage {
    /** Defines common headers for an event message. */
    export namespace Headers {
        /** The type of event. */
        export const eventType = "event-type";
        /** The id of the resource the event is associated with. */
        export const resourceId = "resource-id";
        /** The type of resource the event is associated with. */
        export const resourceType = "resource-type";
    }

    export function isEventMessage(message: IMessage): message is IEventMessage {
        return message.metadata[Headers.eventType] !== undefined;
    }
}