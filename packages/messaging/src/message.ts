export type MessageMetadata = { readonly [key: string]: string | number };

export interface IMessage {
    /** A unique id assigned to the message by the message producer. */
    readonly id: string;
    /** A set of metadata for the message defined as key/value pairs. */
    readonly metadata: MessageMetadata;
    /** The message payload. */
    readonly data: any;
}

// TODO: update/fix event-stream stuff
// TODO: pass ILogger as an option when calling subscribe()

// TODO: in event have an event-id metadata - this is the id assigned to the event for event sourcing... or call it edit-id instead and have that part of the data?
// TODO: is the event id in QK even being used?


// export interface IMessageDetails {
//     /** A set of message headers. */
//     readonly headers?: MessageHeaders;
//     /** The message payload. */
//     readonly body: any;
// }

// export interface IMessage {
//     /** A unique id assigned to the message. */
//     readonly id: string;
//     /** A set of message headers. */
//     readonly headers: MessageHeaders;
//     /** The message payload. */
//     readonly body: any;
// }

export namespace Message {
    export function isMessage(message: any): message is IMessage {
        return typeof (<IMessage>message).id === "string" && (<IMessage>message).metadata !== undefined && (<IMessage>message).data !== undefined;
    }
}