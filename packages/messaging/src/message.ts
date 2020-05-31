export type MessageHeaders = { readonly [key: string]: string | number };

export interface IMessageDetails {
    /** A set of message headers. */
    readonly headers?: MessageHeaders;
    /** The message payload. */
    readonly body: any;
}

export interface IMessage {
    /** A unique id assigned to the message. */
    readonly id: string;
    /** A set of message headers. */
    readonly headers: MessageHeaders;
    /** The message payload. */
    readonly body: any;
}

export namespace Message {
    export function isMessage(data: any): data is IMessage {
        return typeof (<IMessage>data).id === "string" && (<IMessage>data).headers !== undefined && (<IMessage>data).body !== undefined;
    }
}