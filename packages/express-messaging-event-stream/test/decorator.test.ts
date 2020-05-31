import { ExpressFactory, Route, useController } from "@shrub/express";
import { NextFunction, Request, Response } from "express";
import request from "supertest";
import { EventStream } from "../src/decorator";
import { ExpressMessagingEventStreamModule } from "../src/module";


describe("decorator", () => {
    test("with basic event-stream handler", async () => {
        const app = await ExpressFactory.useModules([ExpressMessagingEventStreamModule]).create();
        app.use(useController(FooController));


        const response = await request(app).get("/foo?subscriptionId=123&channel=test");

    });
});

@Route("/foo")
class FooController {
    @EventStream("/", "*")
    openStream(req: Request, res: Response, next: NextFunction): void {
        next();
    }
}