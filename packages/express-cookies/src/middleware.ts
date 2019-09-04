import Cookies from "cookies";
import { Request, RequestHandler } from "express";

declare module "@shrub/express-core/dist/request-context" {
    interface IRequestContext {
        readonly cookies?: ICookies;
    }
}

export interface ICookies {
    get(name: string, options: IGetCookieOptions): ICookie;
}

export interface ICookieOptions {
    /** True if the cookie should not be available to the client. */
    httpOnly?: boolean;
    /** The maximum age for the cookie expressed as the number of milliseconds from the current time, or undefined if the cookie does not expire. */
    maxAge?: number;
    /** True if the cookie is only used with a secure connection. */
    secure?: boolean;
    /** True if the cookie should be signed. */
    signed?: boolean;
}

export interface ICookie {
    readonly name: string;
    readonly options: ICookieOptions;
    readonly value: string;

    delete(): void;
    set(value: string): void;
}

export interface IGetCookieOptions {
    readonly signed?: boolean;
}

export const cookies: RequestHandler = (req, res, next) => {
    const instance: ICookies = {
        get: (name, options) => {
            const value = (<Cookies>req.cookies).get(name, {
                signed: options.signed || true
            });
    
            const cookie = new Cookie(req, name, value);
            cookie.options.signed = options.signed;
            return cookie;
        }
    };

    (<any>req.context.cookies) = instance;
    next();
};

const defaultHttpOnly = true;
const defaultMaxAge = undefined;
const defaultSecure = true;
const defaultSigned = false;

class Cookie implements ICookie {
    readonly options: ICookieOptions = {
        httpOnly: defaultHttpOnly,
        maxAge: defaultMaxAge,
        secure: defaultSecure,
        signed: defaultSigned
    };

    constructor(
        private readonly request: Request, 
        readonly name: string,
        private _value?: string) {
    }

    get value(): string {
        return this._value || "";
    }

    delete(): void {
        this.set("");
    }

    set(value: string): void {
        // the cookies object is the same on the request and the response
        // so just use the one attached to the request for setting the
        // response cookie
        this._value = value;

        // if the value is empty delete the cookie
        const isDelete = !this._value;
        (<Cookies>this.request.cookies).set(
            this.name, 
            isDelete ? undefined : this._value, 
            isDelete ? this.getCookieOptionsForDelete() : this.getCookieOptions());
    }

    private getCookieOptionsForDelete():  Cookies.SetOption {
        // The Cookies library doesn't seem to handle deletion properly if the cookie with the same name
        // was already set for the same request so it needs to be done manually to get around the issue.
        // - set expires to the epoch
        // - set overwrite to overwrite the previous values set for the cookie
        return {
            httpOnly: this.options.httpOnly,
            secure: this.options.secure,
            signed: this.options.signed,
            expires: new Date(0),
            overwrite: true
        };        
    }

    private getCookieOptions(): Cookies.SetOption {
        // the maxAge option doesn't actually set the max-age cookie value, the library uses it to calculate an expire date:
        // it looks like there is a pull request so this behavior may change: 
        // issue - https://github.com/pillarjs/cookies/issues/58
        // pull request - https://github.com/pillarjs/cookies/pull/107
        return {
            httpOnly: this.options.httpOnly,
            maxAge: this.options.maxAge,
            secure: this.options.secure,
            signed: this.options.signed
        };
    }
}