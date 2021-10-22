import { Request, RequestHandler } from "express";
import { IChallengeParameters } from "./authentication";

/** A callback to authorize the provide claims info. */
export type AuthorizeCallback = (context: IAuthorizeContext) => Promise<boolean>;

/** Defines the context in which to authorize a request. */
export interface IAuthorizeContext {
    /** The claims for the currently authenticated user. */
    readonly claims: any;
    /** The request to authorize. */
    readonly request: Request;
}

/** Defines a set of options for the authorization middleware. */
export interface IAuthorizationOptions {
    /** An optional set of parameters (or a request callback that returns parameters) that will get passed to the authentication handler challenging authorization. */
    readonly challengeParameters?: IChallengeParameters | ((req: Request) => IChallengeParameters);
    /** 
     * An optional callback to verify and authorize the specified claims information. 
     * If omitted, the authorization middleware will only verify that a request is made by an authenticated user.
     */
    readonly verify?: AuthorizeCallback;
}

/** Route middleware for requests that require user authorization. If no options are provided the middleware will simply verify if the request has an authenticated user. */
export function authorization(verifyOrOptions?: AuthorizeCallback | IAuthorizationOptions): RequestHandler {
    let challengeParameters: IChallengeParameters | ((req: Request) => IChallengeParameters) | undefined;
    let verify: AuthorizeCallback | undefined;

    verifyOrOptions = verifyOrOptions || {};
    if (typeof verifyOrOptions === "function") {
        verify = verifyOrOptions;
    }
    else {
        challengeParameters = verifyOrOptions.challengeParameters;
        verify = verifyOrOptions.verify;
    }

    const getChallengeParameters = (req: Request) => {
        if (challengeParameters) {
            if (typeof challengeParameters === "function") {
                return challengeParameters(req);
            }

            return challengeParameters;
        }

        return undefined;
    };

    return (req, res, next) => {
        if (!req.context.identity) {
            return next(new Error("Identity middleware not installed."));
        }

        if (!req.context.identity.isAuthenticated) {
            return req.context.identity.challenge(req, res, next, { parameters: getChallengeParameters(req) });
        }

        if (verify) {
            verify({ request: req, claims: req.context.identity.claims }).then(result => {
                if (result) {
                    next();
                }
                else {
                    req.context.identity!.deny(req, res, next);
                }
            });
        }
        else {
            next();
        }
    };
}