import { NextFunction, Request, Response } from "express";
import request from "supertest";
import { IInstantiationService } from "@shrub/core";
import { ExpressFactory, Get, IRequestContext, IRequestContextService, Route, useController } from "../src";

describe("request context service", () => {
    test("ensure request context instance is the same assigned to the current request", async () => {
        const app = await ExpressFactory.create();
        app.use(useController(FooController));

        const response = await request(app).get("/foo");
        expect(response.body.areEqual).toBe(true);
    });   
});

class CaptureRequestContext {
    constructor(@IRequestContextService private readonly service: IRequestContextService) {
    }

    getContext(): IRequestContext | undefined {
        return this.service.current;
    }
}

@Route("/foo")
class FooController {
    @Get("/")
    getFoo(req: Request, res: Response, next: NextFunction): void {
        // the request context service will get injected into the CaptureRequestContext
        // the request context is expected to be the same as the one associated with the Request
        const test = req.context.services.get(IInstantiationService).createInstance(CaptureRequestContext);
        res.json({ areEqual: test.getContext() === req.context });
    }
}