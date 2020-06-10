export type MessageMetadata = { readonly [key: string]: string | number };

export interface IMessage {
    /** A unique id assigned to the message by the message producer. */
    readonly id: string;
    /** A set of metadata for the message defined as key/value pairs. */
    readonly metadata: MessageMetadata;
    /** The message payload. */
    readonly data: any;
}

export namespace Message {
    export function isMessage(message: any): message is IMessage {
        return typeof (<IMessage>message).id === "string" && (<IMessage>message).metadata !== undefined && (<IMessage>message).data !== undefined;
    }
}