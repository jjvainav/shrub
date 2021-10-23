import { ModuleLoader } from "@shrub/core";
import { Get, Route } from "@shrub/express";
import { NextFunction, Request, RequestHandler, Response } from "express";
import createError, { HttpError } from "http-errors";
import { ControllerInvoker, ExpressModule, IControllerInvokerService } from "../src";

interface IInvokerTestContext extends IControllerInvokerService {
}

function createTestContext(): Promise<IInvokerTestContext> {
    let context: IInvokerTestContext;
    return new Promise(resolve => ModuleLoader.useModules([{
        name: "test",
        dependencies: [ExpressModule],
        configure: ({ services }) => {
            const service = services.get(IControllerInvokerService);
            context = { createControllerInvoker: service.createControllerInvoker.bind(service) };
            resolve(context);
        }
    }])
    .load());
}

function isHttpError(err: unknown): err is HttpError {
    return (<HttpError>err).status !== undefined && (<HttpError>err).statusCode !== undefined;
}

function unauthorized(): RequestHandler {
    return (_, __, next) => next(createError(401));
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
    @Get("/secure", unauthorized())
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