import { createService, Transient } from "@shrub/core";
import { IMessageProducer, MessageMetadata } from "@shrub/messaging";
import { EventMessage } from "./event";

/** Handles publishing events against a message producer. */
export interface IEventPublisher {
    /** Publishes an event against the specified channel. */
    publish(channel: string, event: IEventDetails): void;
}

/** Defines the details for an event to be published. */
export interface IEventDetails {
    /** The type of event being published. */
    readonly eventType: string;
    /** The id of the resource the event is associated with. */
    readonly resourceId: string;
    /** A value identifying the type of resource. */
    readonly resourceType: string;
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
        this.producer.send(channel, {
            metadata: {
                ...event.metadata,
                [`${EventMessage.Metadata.eventType}`]: event.eventType,
                [`${EventMessage.Metadata.resourceId}`]: event.resourceId,
                [`${EventMessage.Metadata.resourceType}`]: event.resourceType
            },
            data: event.data
        });
    }
}