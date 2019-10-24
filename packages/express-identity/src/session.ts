import { Request } from "express";
import createError from "http-errors";
import url from "url";
import { ChallengeResult, DenyResult, IAuthenticationHandler, IChallengeParameters } from "./authentication";

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
    /** An optional function for serializing the claims object before saving it to a user session. */
    readonly serialize?: (claims: any) => any;
    /** An optional function for deserializing the claims authorization information stored in a session. */
    readonly deserialize?: (data: any) => any;
}

interface IIdentitySession {
    claims: any;
}

const defaultSessionKey = "identity";

/** Creates an authentication handler that manages authenticating identity information stored in the current user session. */
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

            if (!session.claims) {
                // TODO: instead of failing remove session state and skip?
                return result.fail("Identity missing in session store.");
            }

            result.success(session.claims);
        },
        challenge: (req, result, parameters) => tryChallengeRedirect(req, result, parameters || {}, options!),
        deny: (req, result) => tryRedirect(result, 403, options!.deniedRedirectUrl),
        onLogin: (req, claims) => {
            if (!req.context.session) {
                throw new Error("Session middleware not installed.");
            }

            const session: IIdentitySession = { claims: options!.serialize ? options!.serialize(claims) : claims };
            req.context.session.values[key] = encode(session);
        },
        onLogout: req => {
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