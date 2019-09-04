import { RequestHandler } from "express";
import { CookieSession, ICookieSessionOptions } from "./cookie-session";

export function cookieSession(options: ICookieSessionOptions): RequestHandler {
    return (req, res, next) => {
        if (req.context.session) {
            throw new Error("Session middleware already in use.");
        }

        if (!req.context.cookies) {
            throw new Error("Cookies middleware not installed.");
        }

        const session = new CookieSession(req.context.cookies, options);
        (<any>req.context).session = session;

        const ref = res.writeHead;
        res.writeHead = function writeHead() {
            // gets invoked just before writing headers
            session.saveChanges();
            return ref.apply(res, arguments as any);
        };

        next();
    }
}