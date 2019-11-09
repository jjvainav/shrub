import createError, { HttpError } from "http-errors";
import { IAuthenticationHandler } from "./authentication";

/** Defines options for the token authentication handler. */
export interface ITokenAuthenticationOptions {
    /** The parameter key to use when processing an access token from a query string or url-encoded body; the default is access_token. */
    readonly key?: string;
    /** An optional realm to include with the response header. */
    readonly realm?: string;
    /** Gets one or more scopes for the provided claims; this is used when denying an unauthenticated request. */
    readonly getScopes?: (claims: any) => string | string[];
    /** A callback to verify the bearer token and return the identity claims associated with the token if successful. */
    readonly verifyToken: (token: string, success: (claims: any) => void, fail: (reason: string) => void) => void;
}

interface IAuthenticateHeaderOptions {
    readonly error: string;
    readonly description?: string;
    readonly realm?: string;
    readonly scope?: string | string[];
}

/** Bearer token authentication handler. https://tools.ietf.org/html/rfc6750 */
export function tokenAuthentication(options: ITokenAuthenticationOptions): IAuthenticationHandler {
    return {
        scheme: "bearer-token",
        authenticate: (req, result) => {
            const key = options.key || "access_token";
            let token: string | undefined;

            // TODO: the OAuth Bearer Token spec allows the token to be sent via header, body, or query but we are only going to support header for now
            // https://tools.ietf.org/html/rfc6750#section-2

            if (req.headers) {
                if (req.headers.authorization) {
                    const match = req.headers.authorization.match(/^Bearer\s(.*)$/);
                    if (match) {
                        token = match[1];
                    }
                }

                if (req.headers["content-type"] === "application/x-www-form-urlencoded" && req.body && req.body[key]) {
                    if (token) {
                        return result.error(invalidRequest("Multiple access tokens found."));
                    }
    
                    token = req.body[key];
                }

                if (req.query && req.query[key]) {
                    if (token) {
                        return result.error(invalidRequest("Multiple access tokens found."));
                    }
        
                    token = req.query[key];
                }
            }
    
            if (token) {
                options.verifyToken(
                    token,
                    claims => result.success(claims),
                    reason => result.fail(reason));
            }
            else {
                result.skip();
            }
        },
        challenge: (req, result, parameters, message) => result.send(invalidToken(message)),
        deny: (req, result) => {
            if (req.context.identity && req.context.identity.claims) {
                const scopes = options.getScopes && options.getScopes(req.context.identity.claims);
                return result.send(insufficientScope(options.realm, scopes));
            }   
            
            result.error(new Error("Invalid identity authorization or token, no scopes found."));
        }
    };
}

// send a WWW-Authenticate header with the 4xx responses: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/WWW-Authenticate
// the responses are based on: https://tools.ietf.org/html/rfc6750#section-3

function invalidRequest(realm?: string, description?: string): HttpError {
    description = description || "Invalid request."
    return createError(400, description, {
        headers: {
            "WWW-Authenticate": buildAuthenticateHeader({
                error: "invalid_request",
                description,
                realm
            })
        }
    });
}

function invalidToken(realm?: string, description?: string): HttpError {
    description = description || "Invalid or missing token."
    return createError(401, description, {
        headers: {
            "WWW-Authenticate": buildAuthenticateHeader({
                error: "invalid_token",
                description,
                realm
            })
        }
    });
}

function insufficientScope(realm: string | undefined, scope?: string | string[]): HttpError {
    return createError(403, "Insufficient scope.", {
        headers: {
            "WWW-Authenticate": buildAuthenticateHeader({
                error: "insufficient_scope",
                description: "Insufficient scope.",
                realm,
                scope
            })
        }
    });
}

function buildAuthenticateHeader(options: IAuthenticateHeaderOptions): string {
    let result = "";

    if (options.realm) {
        result = `Bearer realm="${options.realm}" `;
    }

    result += `error="${options.error}" `;

    if (options.description) {
        result += `error_description="${options.description}" `;
    }

    if (options.scope) {
        const scope = Array.isArray(options.scope) ? options.scope.join(" ") : options.scope;
        result += `scope="${scope}" `;
    }

    return result.trim();
}