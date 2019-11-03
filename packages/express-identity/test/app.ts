import express from "express";
import { HttpError } from "http-errors";
import { ISession, ISessionValueCollection } from "@shrub/express-session";
import { IAuthenticationHandler } from "../src/authentication";
import { IAuthorizationOptions, useAuthorization } from "../src/authorization";
import { identity } from "../src/identity";

export interface ITestResponse {
    readonly isAuthenticated: boolean;
    readonly scheme?: string;
    readonly claims: any;
}

export interface ILoginRequest {
    readonly id: string;
    readonly scope: string;
}

export const session = new class implements ISession {
    isDeleted?: boolean;
    maxAge?: number;
    values: ISessionValueCollection = {};
    
    delete(): void {
        this.isDeleted = true;
    }

    keepAlive(): void {
    }
};

export function createTestApp(authenticationHandlers: IAuthenticationHandler[], authorizationOptions?: IAuthorizationOptions): express.Express {
    const app = express();
    const router = express.Router();

    const requestHandlers: express.RequestHandler[] = [];

    // clear the session for each test
    delete session.isDeleted;
    delete session.maxAge;
    session.values = {};

    if (authorizationOptions) {
        requestHandlers.push(useAuthorization(authorizationOptions));
    }

    requestHandlers.push((req, res) => {
        const response: ITestResponse = {
            isAuthenticated: req.context.identity!.isAuthenticated,
            scheme: req.context.identity!.scheme, 
            claims: req.context.identity!.claims
        };

        res.status(200).json(response);
    });

    router.get("/test", requestHandlers);

    // this is intentional to test combining multiple sub routers into a single route
    const subRouter = express.Router();
    subRouter.get("/sub", requestHandlers);
    router.use("/test", subRouter);

    // the login/logout routes are to simply test the identity login/logout methods
    router.post("/login", (req, res) => {
        // just use the query for this, otherwise a body-parser would need to be installed
        const claims = <ILoginRequest>req.query;
        req.context.identity!.login(claims);
        res.status(200).json(claims);
    });

    router.post("/logout", (req, res) => {
        req.context.identity!.logout();
        res.status(200).json({ success: true });
    })

    app.use((req, res, next) => {
        // the context property is set by the express-core module; since the modules are not being used create it manually
        (<any>req).context = { session };
        next();
    });
    app.use(identity({ authenticationHandlers }));
    app.use(router);
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!isHttpError(err)) {
            res.status(500).json({
                error: err.name,
                message: err.message
            });  
        }
        else {
            res.status(err.status).json({
                error: err.name,
                message: err.expose ? err.message : undefined
            });
        }     
    });

    return app;
}

function isHttpError(err: Error): err is HttpError {
    return (<HttpError>err).status !== undefined && (<HttpError>err).statusCode !== undefined;
}