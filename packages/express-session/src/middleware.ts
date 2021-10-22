import { RequestHandler } from "express";
import { CookieSession, ICookieSessionOptions } from "./cookie-session";
import { ISession } from "./session";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        /** Session state for the request if session state is available. */
        session?: ISession;
    }
}

/** Cookie session middleware that gets installed by the module. */
export function cookieSession(options: ICookieSessionOptions): RequestHandler {
    return (req, res, next) => {
        if (req.context.session) {
            throw new Error("A Session is already in use.");
        }
    
        if (!req.context.cookies) {
            throw new Error("Cookies must be installed.");
        }

        const session = new CookieSession(req.context.cookies!, options);
        req.context.session = session;

        const ref = res.writeHead;

        res.writeHead = function writeHead() {
            // gets invoked just before writing headers
            session.saveChanges();
            return ref.apply(res, arguments as any);
        };

        next();
    }
}