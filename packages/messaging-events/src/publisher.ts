import { createService, Transient } from "@shrub/core";
import { IMessageProducer, MessageMetadata } from "@shrub/messaging";
import { EntityEventMessage, EventMessage } from "./event";

/** Handles publishing events against a message producer. */
export interface IEventPublisher {
    /** Publishes an event against the specified channel. */
    publish(channel: string, event: IEventDetails): void;
}

/** Defines the details for an event to be published. */
export interface IEventDetails {
    /** The type of event being published. */
    readonly eventType: string;
    /** The id of the entity the event is associated with. */
    readonly entityId?: string;
    /** A value identifying the type of entity. */
    readonly entityType?: string;
    /** Additional metadata to associate with the event message. */
    readonly metadata?: MessageMetadata;
    /** The event data. */
    readonly data: any;
}

export const IEventPublisher = createService<IEventPublisher>("edit-event-publisher");

@Transient
export class EventPublisher implements IEventPublisher {
    constructor(@IMessageProducer private readonly producer: IMessageProducer) {
    }

    publish(channel: string, event: IEventDetails): void {
        if (event.entityId && !event.entityType) {
            throw new Error("entityType is required if an entity id is provided.");
        }

        if (!event.entityId && event.entityType) {
            throw new Error("entityId is required if an entity type is provided.");
        }

        this.producer.send(channel, {
            metadata: {
                ...event.metadata,
                [`${EventMessage.Metadata.eventType}`]: event.eventType,
                [`${EntityEventMessage.Metadata.entityId}`]: event.entityId,
                [`${EntityEventMessage.Metadata.entityType}`]: event.entityType
            },
            data: event.data
        });
    }
}