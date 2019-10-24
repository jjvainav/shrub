import { Request } from "express";
import { HttpError } from "http-errors";

export type AuthenticationVerifyResult = {
    /** Indicates the authentication was successful. */
    readonly success: (claims: any) => void;
    /** Indicates the authentication failed (e.g. invalid credentials). */
    readonly fail: (message: string) => void;
    /** Indicates an error occurred during authentication. */
    readonly error: (err: Error) => void;
    /** Indicates the authentication should be skipped and allow the next handler to process the request. */
    readonly skip: () => void;
};

export type ChallengeResult = {
    /** Redirects the user to the specified url. */
    readonly redirect: (url: string) => void;
    /** Sends the specified HTTP error. */
    readonly send: (err: HttpError) => void;
    /** Indicates an error occurred while attempting to challenge the authentication. */
    readonly error: (err: Error) => void;
};

export type DenyResult = {
    /** Redirects the user to the specified url. */
    readonly redirect: (url: string) => void;
    /** Sends the specified HTTP error. */
    readonly send: (err: HttpError) => void;
    /** Indicates an error occurred while attempting to deny the authentication. */
    readonly error: (err: Error) => void;
};

export interface IChallengeParameters {
    readonly [key: string]: string | number | boolean;
}

/** An observer for the authentication login/logout events. */
export interface IAuthenticationObserver {
    /** Gets invoked when a user has logged in. */
    readonly onLogin?: (req: Request, claims: any) => void;
    /** Gets invoked when a user has logged out. */
    readonly onLogout?: (req: Request, claims: any) => void;
}

/** Handles authenticating a request. */
export interface IAuthenticationHandler extends IAuthenticationObserver {
    /** The default scheme name for the authentication handler. */
    readonly scheme: string;
    /** Authenticates the current response. */
    readonly authenticate: (req: Request, result: AuthenticationVerifyResult) => void;
    /** 
     * Challenges the current authentication scheme. 
     * This is typically invoked when a request requires a user to be authenticated using this scheme.
     * If not defined, the default is to send a 401 status.
     */
    readonly challenge?: (req: Request, result: ChallengeResult, parameters?: IChallengeParameters, message?: string) => void;
    /** 
     * Denies access for the current user. 
     * This is invoked when a user has been authenticated using this scheme but failed authorization.
     * If not defined, the default is to send a 403 status.
     */
    readonly deny?: (req: Request, result: DenyResult) => void;
}