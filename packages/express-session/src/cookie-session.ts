import { createOptions } from "@shrub/core";
import { ICookie, ICookies } from "@shrub/express-cookies";
import { ISession, ISessionOptions, ISessionValueCollection } from "./session";

export const ICookieSessionOptions = createOptions<ICookieSessionOptions>("cookie-session");

export interface ICookieSessionOptions extends ISessionOptions {
    /** The name of the cookie used for a session; the default is '_sess'. */
    readonly cookieName?: string;
    /** True if the session is only used with a secure connection; the default is true. */
    readonly secure?: boolean;
    /** True if the session values should be signed to detect tampering; the default is true. */
    readonly signed?: boolean;
}

const defaultSecure = true;
const defaultSigned = true;
const defaultCookieName = "_sess";

export class CookieSession implements ISession {
    private readonly context = new SessionContext();
    private readonly cookie: ICookie;
    private pendingDelete?: boolean;

    constructor(cookies: ICookies, options: ICookieSessionOptions) {
        this.cookie = cookies.get(options.cookieName || defaultCookieName, {
            signed: options.signed !== undefined ? options.signed : defaultSigned
        });

        this.cookie.options.httpOnly = true;
        this.cookie.options.secure = options.secure !== undefined ? options.secure : defaultSecure;
        this.cookie.options.signed = options.signed !== undefined ? options.signed : defaultSigned;

        // set the maxAge against the context because the maxAge option is read/write
        this.context.maxAge = options.maxAge;

        if (this.cookie.value) {
            this.context.load(this.decode(this.cookie.value));
        }

        this.context.acceptChanges();
    }

    get maxAge(): number | undefined {
        return this.context.maxAge;
    }

    set maxAge(value: number | undefined) {
        this.context.maxAge = value;
    }

    get values(): ISessionValueCollection {
        return this.context.values;
    }

    delete(): void {
        this.pendingDelete = true;
    }

    keepAlive(): void {
        this.context.keepAlive();
    }

    saveChanges(): void {
        if (this.context.isEmpty || this.pendingDelete) {
            // only need to delete if the session is not new
            if (!this.context.isNew) {
                this.cookie.delete();
            }
        }
        else if (this.context.hasChanges) {
            this.cookie.options.maxAge = this.context.maxAge;
            this.cookie.set(this.encode(this.context.values));
        }
    }

    static isCookieSession(session: ISession): session is CookieSession {
        return Object.getPrototypeOf(session).constructor === CookieSession;
    }

    private decode<T>(value: string): T {
        return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    }

    private encode(obj: any): string {
        return Buffer.from(JSON.stringify(obj)).toString("base64");
    }
}

class SessionContext {
    private _maxAge?: number;
    private _isNew = true;
    private _hasChanges = false;

    readonly values: ISessionValueCollection = (function (self: SessionContext) { 
        return new Proxy<ISessionValueCollection>({}, {
            set: function (target, prop, value) {
                if (value === undefined || value === "") {
                    // physically delete the property so that the context can properly detect if the value collection is truely empty or not
                    delete target[<string>prop];    
                }
                else {
                    target[<string>prop] = value;
                }

                self._hasChanges = true;
                return true;
            }
        });
    })(this);

    get maxAge(): number | undefined {
        return this._maxAge;
    }

    set maxAge(value: number | undefined) {
        if (this._maxAge !== value) {
            this._maxAge = value;
            this._hasChanges = true;
        }
    }

    get isEmpty(): boolean {
        return Object.keys(this.values).length === 0;
    }

    get isNew(): boolean {
        return this._isNew;
    }

    get hasChanges(): boolean {
        return this._hasChanges;
    }

    acceptChanges(): void {
        this._hasChanges = false;
    }

    keepAlive(): void {
        this._hasChanges = true;   
    }

    load(values: ISessionValueCollection): void {
        Object.assign(this.values, values);
        this.acceptChanges();
        this._isNew = false;
    }
}