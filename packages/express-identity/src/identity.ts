import { IRequestContext } from "@shrub/express";
import { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import { AuthenticationVerifyResult, IAuthenticationHandler, IAuthenticationObserver, IChallengeParameters } from "./authentication";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        readonly identity?: IIdentity;
    }

    interface IRequestContextBuilder {
        /** 
         * Adds the identity to the request context with an optional set of properties. 
         * The options are optional; by default, the options configured with the module will be used.
         */
        addIdentity(options?: IIdentityOptions): IRequestContextBuilder;
    }
}

export interface IChallengeOptions {
    /** A set of parameters that get passed to an authentication handler when challenging authorization. */
    readonly parameters?: IChallengeParameters;
    /** An optional scheme to challenge. */
    readonly scheme?: string;
}

/** Manages authenticated users for a request. */
export interface IIdentity {
    /** The authentication scheme responsible for authenticating or denying the user. */
    readonly scheme?: string;
    /** The claims for the currently authenticated user. */
    readonly claims?: any;
    /** Indicates if the current request has an authenticated user; if not defined, then the current request has not yet been authenticated. */
    readonly isAuthenticated?: boolean;
    /** Authenticates the current request. */
    authenticate(): IAuthenticateResult;
    /** Challenges the current authentication scheme. This is intended to be used inside express middleware. */
    challenge(req: Request, res: Response, next: NextFunction, options?: IChallengeOptions): void;
    /** Denies access for the current user. This is intended to be used inside express middleware. */
    deny(req: Request, res: Response, next: NextFunction): void;    
    /** Invoke to create a new session for an authenticated user with the provided claims. */
    login(claims: any): void;
    /** Invoke to log out and destroy the current session. */
    logout(): void;
}

/** The result from initializing and authenticating an identity for the current request. */
export interface IAuthenticateResult {
    /** An error if the creation or authentication of the identity resulted in an error. */
    readonly error?: Error;
    /** This will be the authentication handler if a failure was reported by an authentication handler. */
    readonly handler?: IAuthenticationHandler;
    /** True if the request has been authenticated. */
    readonly isAuthenticated?: boolean;
    /** True if the request authentication had failed; the handler will be the handler that challenged the authentication. */
    readonly isChallenged?: boolean;
    /** True if the request was authenticated but was not authorized to make the request. */
    readonly isDenied?: boolean;
    /** An optional message describing the result of the authentication. */
    readonly message?: string;
}

/** Defines options for the identity middleware. */
export interface IIdentityOptions {
    /** A list of authentication handlers responsible for authenticating a request. */
    readonly authenticationHandlers: IAuthenticationHandler[];
    /** An optional list of authentication observers. */
    readonly authenticationObservers?: IAuthenticationObserver[];
}

/** @internal */
export const addIdentityRequestBuilder = (context: IRequestContext, options: IIdentityOptions) => {
    const handlers = options.authenticationHandlers;
    let result: IAuthenticateResult | undefined;
    let scheme: string | undefined;
    let claims: any;

    const identity: IIdentity = {
        get claims(): string | undefined {
            return claims;
        },
        get isAuthenticated(): boolean | undefined { 
            return result && result.isAuthenticated === true;
        },
        get scheme(): any {
            return scheme;
        },
        authenticate(): IAuthenticateResult {
            if (options.authenticationHandlers.length) {
                // index for the current authentication handler
                let index = 0;
                const verifyResult: AuthenticationVerifyResult = {
                    success: c => {
                        if (result) { throw new Error("Authentication processing is already done."); }
                        if (!c) { throw new Error("claims required"); }
        
                        scheme = options.authenticationHandlers[index].scheme;
                        claims = c;
        
                        result = { isAuthenticated: true };
                    },
                    fail: message => {
                        if (result) { throw new Error("Authentication processing is already done."); }

                        scheme = options.authenticationHandlers[index].scheme;
                        result = { handler: options.authenticationHandlers[index], isChallenged: true, message };
                    },
                    error: error => {
                        if (result) { throw new Error("Authentication processing is already done."); }
                        result = { error };
                    },
                    skip: () => {
                        if (result) { throw new Error("Authentication processing is already done."); }
        
                        index++;
                        if (options.authenticationHandlers.length > index) {
                            options.authenticationHandlers[index].authenticate(context, verifyResult);
                        }
                    }
                };
        
                // this will initiate the first authentication handler; each handler is expected
                // to invoke one of the result functions and if the handler wants to ignore or pass
                // the request to the next handler it should invoke 'skip'
                options.authenticationHandlers[index].authenticate(context, verifyResult);
            }

            result = result || { isAuthenticated: false };
            return result;
        },
        challenge: function(req: Request, res: Response, next: NextFunction, options?: IChallengeOptions) {
            const scheme = options && options.scheme || this.scheme;

            if (scheme) {
                const handler = getHandler(handlers, scheme);
                if (!handler) {
                    throw new Error(`Invalid scheme (${scheme}), no authentication handler found.`);
                }

                challenge(handler, options && options.parameters, undefined, req, res, next);
            }
            else if (handlers.length === 1) {
                challenge(handlers[0], options && options.parameters, undefined, req, res, next);
            }
            else if (handlers.length === 0) {
                throw new Error("No authentication handlers have been registered.");
            }
            else {
                throw new Error("Multiple authentication handlers registered and no default scheme defined.");
            }
        },
        deny: function(req: Request, res: Response, next: NextFunction) {
            const handler = scheme && getHandler(options.authenticationHandlers, scheme);

            if (handler) {
                deny(handler, req, res, next);
            }
            else {
                next(createError(403));
            }
        }, 
        login: function(claims: any) {
            // note: When a user is logged in do not set the claims, the authentication handlers
            // are responsible for processing requests and setting the claims. In general,
            // the claims will be available upon the next request.
            on(options.authenticationHandlers, o => o.onLogin, fn => fn(context, claims));
            on(options.authenticationObservers, o => o.onLogin, fn => fn(context, claims));
        },
        logout: function() {
            if (this.isAuthenticated) {
                on(options.authenticationHandlers, o => o.onLogout, fn => fn(context, (<any>this).claims));
                on(options.authenticationObservers, o => o.onLogout, fn => fn(context, (<any>this).claims));

                scheme = undefined;
                claims = undefined;
            }
        }
    };

    // set a new instance of the request context so that the identity and authentication handlers have the updated context with the identity
    context = <IRequestContext>{ ...context, identity };

    return context;
};

/** @internal Identity middleware for adding the identity and authenticating the current request. */
export const identityMiddleware = (options: IIdentityOptions) => (req: Request, res: Response, next: NextFunction) => {
    const identity = req.contextBuilder.addIdentity(options).instance().identity!;
    const result = identity.authenticate();

    if (result.isChallenged) {
        identity.challenge(req, res, next);
    }
    else if (result.isDenied) {
        identity.deny(req, res, next);
    }
    else {
        next(result.error);
    }
};

function on<TFunction extends Function>(
    observers: IAuthenticationObserver[] | undefined, 
    getCallback: (observer: IAuthenticationObserver) => TFunction | undefined,
    invoke: (fn: TFunction) => void): void {
    if (observers) {
        observers.forEach(observer => {
            const fn = getCallback(observer);
            if (fn) {
                invoke(fn);
            }
        });
    }
}

function challenge(handler: IAuthenticationHandler, parameters: IChallengeParameters | undefined, message: string | undefined, req: Request, res: Response, next: NextFunction): void {
    // note: need to be careful to ONLY invoke next with an error since this function is exposed to handlers down the chain
    if (handler.challenge) {
        handler.challenge(req, {
            redirect: url => res.redirect(url),
            send: err => next(err),
            error: err => next(err)
        },
        parameters,
        message);
    }
    else {
        next(createError(401));
    }
}

function deny(handler: IAuthenticationHandler, req: Request, res: Response, next: NextFunction): void {
    // note: need to be careful to ONLY invoke next with an error since this function is exposed to handlers down the chain
    if (handler.deny) {
        handler.deny!(req, {
            redirect: url => res.redirect(url),
            send: err => next(err),
            error: err => next(err)
        });
    }
    else {
        next(createError(403));
    }
}

function getHandler(handlers: IAuthenticationHandler[], scheme: string): IAuthenticationHandler | undefined {
    for (const handler of handlers) {
        if (handler.scheme === scheme) {
            return handler;
        }
    }

    return undefined;
}