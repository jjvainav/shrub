import { ModuleLoader } from "@shrub/core";
import { NextFunction, Request, RequestHandler, Response } from "express";
import createError, { HttpError } from "http-errors";
import { ControllerInvoker, ExpressModule, Get, IControllerInvokerService, IExpressConfiguration, Route } from "../src";

interface IInvokerTestContext extends IControllerInvokerService {
}

const expectedToken = "valid_token";
const tokenMiddleware = (token: string) => (req: Request, res: Response, next: NextFunction) => {
    // this middleware is used to test injecting a token into the request before the applicatin's request pipeline is invoked
    Object.defineProperty(req, "token", { value: token });
    next();
};

function createTestContext(): Promise<IInvokerTestContext> {
    return new Promise(resolve => ModuleLoader.useModules([{
        name: "test",
        dependencies: [ExpressModule],
        configure: ({ config, services }) => {
            const service = services.get(IControllerInvokerService);

            config.get(IExpressConfiguration).use((req, res, next) => {
                // the tests expect the token to be injected prior to getting here
                Object.defineProperty(req, "isAuthenticated", { value: (<any>req).token === expectedToken });
                next();
            });

            resolve({ createControllerInvoker: service.createControllerInvoker.bind(service) });
        }
    }])
    .load());
}

function isHttpError(err: unknown): err is HttpError {
    return (<HttpError>err).status !== undefined && (<HttpError>err).statusCode !== undefined;
}

function authorize(): RequestHandler {
    return (req, __, next) => {
        // authorize any authenticated request
        if (!(<any>req).isAuthenticated) {
            return next(createError(401));
        }

        next();
    };
}

describe("invoker", () => {
    let context: IInvokerTestContext;

    beforeEach(async () => {
        context = await createTestContext();
    });

    test("for basic GET action", async () => {
        const invoker = context.createControllerInvoker(FooControllerInvoker);

        const result = await invoker.getFoo();
        
        expect(result).toBe("foo");
    });

    test("for basic GET action that uses query string", async () => {
        const invoker = context.createControllerInvoker(FooControllerInvoker);

        const result = await invoker.getFoo("bar");
        
        expect(result).toBe("foobar");
    });

    test("for basic GET action that requires a url param", async () => {
        const invoker = context.createControllerInvoker(FooControllerInvoker);

        const result = await invoker.getFooById(1);
        
        expect(result).toBe("foo1");
    });

    test("for basic GET action that fails due to action specific middleware", async () => {
        const invoker = context.createControllerInvoker(FooControllerInvoker);

        try {
            await invoker.getSecureFoo();
            fail();
        }
        catch (err) {
            if (isHttpError(err)) {
                expect(err.statusCode).toBe(401);
            }
            else {
                fail("Unexpected error.");
            }
        }
    });

    test("for basic GET action that succeeds when preparing a request before invoking an action", async () => {
        const invoker = context.createControllerInvoker(FooControllerInvoker, {
            // this will inject the token and 
            prepare: tokenMiddleware(expectedToken)
        });

        const result = await invoker.getSecureFoo();

        expect(result).toBe("foo");
    });

    test("for basic GET action that attempts a retry after a failed action", async () => {
        // first use an invalid token
        let token = "invalid_token";
        const invoker = context.createControllerInvoker(FooControllerInvoker, {
            prepare: (req, res, next) => tokenMiddleware(token)(req, res, next),
            error: (err, req, res, next, retry, retryCount) => {
                // only allow a single retry
                if (!retryCount && isHttpError(err) && err.statusCode === 401) {
                    // reset the token to a valid one
                    token = expectedToken;
                    retry();
                }
                else {
                    // unexpected, pass it down
                    next(err);
                }
            }
        });

        const result = await invoker.getSecureFoo();

        expect(result).toBe("foo");
    });

    test("for basic GET action that fails during retry", async () => {
        // first use an invalid token
        let token = "invalid_token";
        let totalRetryCount = 0;
        const invoker = context.createControllerInvoker(FooControllerInvoker, {
            prepare: (req, res, next) => tokenMiddleware(token)(req, res, next),
            error: (err, req, res, next, retry, retryCount) => {
                totalRetryCount = retryCount;

                // only allow a single retry
                if (retryCount < 2 && isHttpError(err) && err.statusCode === 401) {
                    if (retryCount === 1) {
                        // reset the token to a valid one
                        token = expectedToken;
                    }

                    // this will keep track of the total number of retries that were attempted
                    totalRetryCount++;
                    retry();
                }
                else {
                    // unexpected, pass it down
                    next(err);
                }
            }
        });

        const result = await invoker.getSecureFoo();

        expect(result).toBe("foo");
        expect(totalRetryCount).toBe(2);
    });
});

@Route("/foo")
class FooController {
    @Get("/")
    getFoo(req: Request, res: Response, next: NextFunction): void {
        let foo = "foo";

        if (req.query.concat) {
            foo = foo + req.query.concat;
        }

        res.json({ foo });
    }

    // this needs to come before getFooById so it's route gets registered first
    @Get("/secure", authorize())
    getSecureFoo(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "foo" });
    }

    @Get("/:id")
    getFooById(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "foo" + req.params.id });
    }
}

class FooControllerInvoker extends ControllerInvoker {
    getFoo(concat?: string): Promise<string> {
        let path = "/foo";

        if (concat) {
            path = `${path}?concat=${concat}`;
        }

        return this.invokeAction({
            controller: FooController,
            method: "GET",
            path
        })
        .then(response => response.data.foo);
    }

    getFooById(id: number): Promise<string> {
        return this.invokeAction({
            controller: FooController,
            method: "GET",
            path: `/foo/${id}`
        })
        .then(response => response.data.foo);
    }

    getSecureFoo(): Promise<string> {
        return this.invokeAction({
            controller: FooController,
            method: "GET",
            path: "/foo/secure"
        })
        .then(response => response.data.foo);
    }
}