import { createService, Transient } from "@shrub/core";
import { IMessageProducer, MessageMetadata } from "@shrub/messaging";
import { EventMessage } from "./event";

/** Handles publishing events against a message producer. */
export interface IEventPublisher {
    /** Publishes an event against the specified channel. */
    publish(channel: string, event: IEventDetails): Promise<void>;
}

/** Defines the details for an event to be published. */
export interface IEventDetails {
    /** The type of event being published. */
    readonly eventType: string;
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

    publish(channel: string, event: IEventDetails): Promise<void> {
        return this.producer.send(channel, {
            metadata: {
                ...event.metadata,
                [`${EventMessage.Metadata.eventType}`]: event.eventType
            },
            data: event.data
        });
    }
}