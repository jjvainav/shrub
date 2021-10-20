import { IRequestContext } from "@shrub/express";
import { RequestHandler } from "express";
import { CookieSession, ICookieSessionOptions } from "./cookie-session";
import { ISession } from "./session";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        /** Session state for the request if session state is available. */
        readonly session?: ISession;
    }

    interface IRequestContextBuilder {
        /** Adds a cookie session to the request context. */
        addCookieSession(options: ICookieSessionOptions): IRequestContextBuilder;
    }
}

/** Adds a cookie session to the request context and requires cookies to be installed against the provided request context. */
export const addCookieSessionRequestBuilder = (context: IRequestContext, options: ICookieSessionOptions) => {
    if (context.session) {
        throw new Error("A Session is already in use.");
    }

    if (!context.cookies) {
        throw new Error("Cookies must be installed.");
    }

    context = <IRequestContext>{ ...context, session: new CookieSession(context.cookies, options) };

    return context;
};

/** @internal */
export function cookieSession(options: ICookieSessionOptions): RequestHandler {
    return (req, res, next) => {
        req.contextBuilder.addCookieSession(options);
        const session = <CookieSession>req.context.session;
        const ref = res.writeHead;

        res.writeHead = function writeHead() {
            // gets invoked just before writing headers
            session.saveChanges();
            return ref.apply(res, arguments as any);
        };

        next();
    }
}