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
    /** The authentication schemes allowed for the authorized request; if not defined, all schemes are allowed. */
    readonly schemes?: string[];
    /** 
     * An optional callback to verify and authorize the specified claims information. 
     * If omitted, the authorization middleware will only verify that a request is made by an authenticated user.
     */
    readonly verify?: AuthorizeCallback;
}

/** Route middleware for requests that require user authorization. If no options are provided the middleware will simply verify if the request has an authenticated user. */
export function useAuthorization(verifyOrOptions?: AuthorizeCallback | IAuthorizationOptions): RequestHandler {
    let challengeParameters: IChallengeParameters | ((req: Request) => IChallengeParameters) | undefined;
    let schemes: string[] | undefined;
    let verify: AuthorizeCallback | undefined;

    verifyOrOptions = verifyOrOptions || {};
    if (typeof verifyOrOptions === "function") {
        verify = verifyOrOptions;
    }
    else {
        challengeParameters = verifyOrOptions.challengeParameters;
        schemes = verifyOrOptions.schemes;
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
            return challenge(req, getChallengeParameters(req), schemes);
        }

        if (schemes && schemes.indexOf(req.context.identity.scheme!) === -1) {
            return challenge(req, getChallengeParameters(req), schemes);
        }

        if (verify) {
            verify({ request: req, claims: req.context.identity.claims }).then(result => {
                if (result) {
                    next();
                }
                else {
                    req.context.identity!.deny();
                }
            });
        }
        else {
            next();
        }
    };
}

function challenge(req: Request, challengeParameters?: IChallengeParameters, schemes?: string[]): void {
    req.context.identity!.challenge({
        parameters: challengeParameters,
        // TODO: what if there are multiple schemes?
        scheme: schemes && schemes.length ? schemes[0] : undefined,
    });
}