import { createService } from "@shrub/core";
import { NextFunction, Request, Response } from "express";
import request from "supertest";
import { controller, ExpressFactory, Get, Route } from "../src";

describe("request context service", () => { 
    test("ensure scoped service state between multiple invocations", async () => {
        const app = await ExpressFactory.useModules([{
            name: "test",
            configureServices: registration => registration.registerScoped(ITestService, TestService)
        }])
        .create();

        app.use(controller(FooController));

        const responses = await Promise.all([
            request(app).get("/foo"),
            request(app).get("/foo")
        ]);

        expect(responses[0].body.before).toBe(responses[0].body.after);
        expect(responses[1].body.before).toBe(responses[1].body.after);

        expect(responses[0].body.before).not.toBe(responses[1].body.before);
    });   
});

interface ITestService {
    readonly value: number;
}

let counter = 1;
const ITestService = createService<ITestService>("test-service");

class TestService implements ITestService {
    readonly value = counter++;
}

@Route("/foo")
class FooController {
    @Get("/")
    getFoo(req: Request, res: Response, next: NextFunction): void {
        // scoped services allow maintaining state between async calls while handling a request
        // capture the value before and after the 'async' call to verify the state is unchanged
        const before = req.context.services.get(ITestService).value;
        setTimeout(() => res.json({ before, after: req.context.services.get(ITestService).value }), 0);
    }
}