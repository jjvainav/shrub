import createId from "@sprig/unique-id";

export type MessageHeaders = { readonly [key: string]: string | number };

export interface IMessage {
    /** A unique id for the message. */
    readonly id: string;
    /** A set of message headers. */
    readonly headers: MessageHeaders;
    /** The message payload. */
    readonly data: any;
}

export interface IMessageOptions {
    /** A set of message headers. */
    readonly headers: MessageHeaders;
    /** The message payload. */
    readonly data: any;
}

export namespace Message {
    export function create(options: IMessageOptions): IMessage {
        return {
            id: createId(),
            headers: options.headers,
            data: options.data
        };
    }

    export function isMessage(data: any): data is IMessage {
        return typeof (<IMessage>data).id === "string" && (<IMessage>data).headers !== undefined && (<IMessage>data).data !== undefined;
    }
}