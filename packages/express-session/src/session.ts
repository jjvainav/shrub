declare module "@shrub/express-core/dist/request-context" {
    interface IRequestContext {
        /** Session state for the request if session state is available. */
        readonly session?: ISession;
    }
}

export interface ISession {
    /** 
     * The maximum age for the session expressed as the number of milliseconds from the current time, or undefined if the session context does not expire. 
     * This is scoped to the current session and modifying the value allows different options for the maxAge on a per-session basis.
     */
    maxAge?: number;
    /** A collection of values for the session. */
    readonly values: ISessionValueCollection;
    /** Force delete the session. */
    delete(): void;
    /** Reset the session's expiration based on its max age. */
    keepAlive(): void;
}

export interface ISessionOptions {
    /** The maximum age for the session expressed as the number of milliseconds from the current time, or undefined if the session context does not expire. */
    readonly maxAge?: number;
}

/** A read/write collection of values stored in a session. */
export interface ISessionValueCollection {
    [key: string]: string | boolean | number | undefined;
}