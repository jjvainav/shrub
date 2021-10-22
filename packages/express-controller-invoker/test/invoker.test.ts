import { IModule, ModuleLoader } from "@shrub/core";
import { ExpressModule, Get, IExpressApplication, Route } from "@shrub/express";
import { authorization, ExpressIdentityModule, IExpressIdentityConfiguration } from "@shrub/express-identity";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "http-errors";
import { ControllerInvoker, createControllerInvokerType, ExpressControllerInvokerModule, IExpressControllerInvokerConfiguration } from "../src";

interface IInvokerTestContext {
    readonly app: IExpressApplication;
    allow: boolean;
}

interface IFooControllerInvoker {
    getFoo(): Promise<string>;
    getFooById(id: number): Promise<string>;
    getSecureFoo(): Promise<string>;
}

function createTestContext(modules?: IModule[]): Promise<IInvokerTestContext> {
    let context: IInvokerTestContext;
    modules = modules || [];
    return new Promise(resolve => ModuleLoader.useModules([{
        name: "test",
        dependencies: [
            ExpressModule, 
            ExpressIdentityModule,
            ...modules!
        ],
        configure: ({ services, config }) => {
            config.get(IExpressIdentityConfiguration).useAuthentication({
                scheme: "test-context",
                authenticate: (_, result) => {
                    if (context.allow) {
                        result.success({});
                    }
                    else {
                        result.fail("Authentication failed.");
                    }
                }
            });

            context = { app: services.get(IExpressApplication), allow: true };
            resolve(context);
        }
    }])
    .load());
}

function isHttpError(err: unknown): err is HttpError {
    return (<HttpError>err).status !== undefined && (<HttpError>err).statusCode !== undefined;
}

const IFooControllerInvoker = createControllerInvokerType<IFooControllerInvoker>("foo-controller-invoker");

describe("invoker", () => {
    let context: IInvokerTestContext;

    beforeEach(async () => {
        context = await createTestContext();
    });

    test("for basic GET action", async () => {
        const invoker = new FooControllerInvoker({ app: context.app });

        const result = await invoker.getFoo();
        
        expect(result).toBe("foo");
    });

    test("for basic GET action that requires a url param", async () => {
        const invoker = new FooControllerInvoker({ app: context.app });

        const result = await invoker.getFooById(1);
        
        expect(result).toBe("foo1");
    });

    test("for basic GET action that requires authorization and is allowed", async () => {
        const invoker = new FooControllerInvoker({ app: context.app });

        const result = await invoker.getSecureFoo();
        
        expect(result).toBe("foo");
    });

    test("for basic GET action that requires authorization and is not allowed", async () => {
        context.allow = false;
        const invoker = new FooControllerInvoker({ app: context.app });

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
});

describe("invoker factory", () => {
    // TODO: create tests to test registering invoker factories
    // -- update createTestContext to accept a module that will handler registering the context
    // -- need to then test injecting the controller invoker or getting it from services

    test("for basic GET action", async () => {
        const context = await createTestContext([{
            name: "test",
            dependencies: [ExpressControllerInvokerModule],
            configure: ({ config }) => {
                config.get(IExpressControllerInvokerConfiguration).useControllerInvoker(IFooControllerInvoker);
            }

        }]);


        const invoker = new FooControllerInvoker({ app: context.app });

        const result = await invoker.getFoo();
        
        expect(result).toBe("foo");
    });
});

@Route("/foo")
class FooController {
    @Get("/")
    getFoo(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "foo" });
    }

    // this needs to come before getFooById so it's route gets registered first
    @Get("/secure", authorization())
    getSecureFoo(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "foo" });
    }

    @Get("/:id")
    getFooById(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "foo" + req.params.id });
    }
}

class FooControllerInvoker extends ControllerInvoker {
    getFoo(): Promise<string> {
        return this.invokeAction({
            controller: FooController,
            method: "GET",
            path: "/foo"
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