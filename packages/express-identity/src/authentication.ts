import { Request } from "express";
import createError, { HttpError } from "http-errors";
import url from "url";

export type AuthenticationVerifyResult = {
    /** Indicates the authentication was successful. */
    readonly success: (user: any, auth: any) => void;
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
    readonly onLogin?: (req: Request, user: any, auth: any) => void;
    /** Gets invoked when a user has logged out. */
    readonly onLogout?: (req: Request, user: any, auth: any) => void;
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

/** Defines options for the session authentication handler. */
export interface ISessionAuthenticationOptions {
    /** An optional redirect url for an unauthorized request; otherwise, a 403 status will be returned. */
    readonly deniedRedirectUrl?: string;
    /** An optional redirect url for an unauthenticated request; otherwise, a 401 status will be returned. */
    readonly failureRedirectUrl?: string;
    /** An optional query parameter key identifying the original request that was not authorized and will be passed to the failureRedirectUrl if one was specified. */
    readonly returnToUrlKey?: string;
    /** The session key for the user's session; the default is 'identity'. */
    readonly sessionKey?: string;
    /** An optional function for serializing a user's authorization object before saving it to a user session. */
    readonly serializeAuth?: (user: any) => any;
    /** An optional function for serializing a user object before saving it to a user session. */
    readonly serializeUser?: (user: any) => any;
    /** An optional function for deserializing a user's authorization information stored in a session; the result is set as the identity auth. */
    readonly deserializeAuth?: (data: any) => any;
    /** An optional function for deserializing user information stored in a session; the result is set as the identity user. */
    readonly deserializeUser?: (data: any) => any;
}

interface IIdentitySession {
    auth: any;
    user: any;
}

const defaultSessionKey = "identity";

/** Creates an authentication that manages authenticating identity information stored in the current user session. */
export function sessionAuthentication(options?: ISessionAuthenticationOptions): IAuthenticationHandler {
    options = options || {};
    const key = options.sessionKey || defaultSessionKey;

    return {
        scheme: "session",
        authenticate: (req, result) => {
            if (!req.context.session) {
                return result.error(new Error("Session middleware not installed."));
            }

            const session = decode<IIdentitySession>(<string>req.context.session!.values[key]);
            if (!session) {
                return result.skip();
            }

            if (!session.user || !session.auth) {
                // TODO: instead of failing remove session state and skip?
                return result.fail("Identity missing in session store.");
            }

            result.success(session.user, session.auth);
        },
        challenge: (req, result, parameters) => tryChallengeRedirect(req, result, parameters || {}, options!),
        deny: (req, result) => tryRedirect(result, 403, options!.deniedRedirectUrl),
        onLogin: (req, user, auth) => {
            if (!req.context.session) {
                throw new Error("Session middleware not installed.");
            }

            const session: IIdentitySession = {
                auth: options!.serializeAuth ? options!.serializeAuth(auth) : auth,
                user: options!.serializeUser ? options!.serializeUser(user) : user
            };

            req.context.session.values[key] = encode(session);
        },
        onLogout: (req, user, auth) => {
            if (!req.context.session) {
                throw new Error("Session middleware not installed.");
            }

            req.context.session.values[key] = undefined;
        }
    };
}

function tryChallengeRedirect(req: Request, result: ChallengeResult, parameters: IChallengeParameters, options: ISessionAuthenticationOptions): void {
    if (options.failureRedirectUrl) {
        // add the 'return to' url to the parameters if one does not exist already
        parameters = options.returnToUrlKey && !parameters[options.returnToUrlKey]
            ? { ...parameters, [options.returnToUrlKey]: req.originalUrl }
            : parameters;

        // the below logic is weird but there seems to be an issue setting the query object
        // if the value has certain characters where it won't be included in the output
        // e.g. return_to = /test/sub?value=foo

        const temp = url.parse(options.failureRedirectUrl, true);

        // append any parameters to the redirect url
        let flag = false;
        for (const key in parameters) {
            temp.query[key] = <any>parameters[key];
            flag = true;
        }

        // the temp.query object will still contain the 'invalid' parameters
        // so convert it into a URLSearchParams object
        const searchParams = new URLSearchParams(<any>temp.query);

        // this will clear the query/search params for the url
        temp.query = {};
        temp.search = "";

        // convert the url object to a string and manually append the query parameters
        const redirect = flag 
            ? `${url.format(temp)}?${searchParams.toString()}`
            : url.format(temp);

        return tryRedirect(result, 401, redirect);
    }

    return tryRedirect(result, 401, undefined);
}

function tryRedirect(result: ChallengeResult | DenyResult, status: number, url?: string): void {
    if (url) {
        result.redirect(url);
    }
    else {
        result.send(createError(status));
    }
}

function decode<T>(value?: string): T | undefined {
    return value && JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function encode(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64");
}