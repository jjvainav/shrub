import { NextFunction, Request, Response, Router } from "express";
import * as request from "supertest";
import { Get, Post, Route, useController } from "../src/controller";
import { createApp } from "./app";

describe("controller", () => {
    test("with basic GET handler", async () => {
        const app = await createApp();
        app.use(useController(FooController));

        const response = await request(app).get("/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("get");
    });

    test("with basic POST handler", async () => {
        const app = await createApp();
        app.use(useController(FooController));

        const response = await request(app).post("/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("post");
    });

    test("with GET handler for path containing parameter", async () => {
        const app = await createApp();
        app.use(useController(FooController));

        const response = await request(app).get("/foo/123");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("123");
    });

    test("with multiple Get decorators for the same handler", async () => {
        const app = await createApp();
        app.use(useController(FooController));

        const response1 = await request(app).get("/foo/1");
        const response2 = await request(app).get("/foo/2");

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        expect(response1.body.foo).toBe("/1");
        expect(response2.body.foo).toBe("/2");
    });

    test("with multiple routes for the same handler", async () => {
        const app = await createApp();
        app.use(useController(FooController));

        const response1 = await request(app).get("/foo/3");
        const response2 = await request(app).get("/foo/4");

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        expect(response1.body.foo).toBe("/3");
        expect(response2.body.foo).toBe("/4");
    });

    test("with base router", async () => {
        const app = await createApp();
        const base = Router();

        base.use("/base", useController(FooController));
        app.use(base);

        const response = await request(app).get("/base/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("get");
    }); 
    
    test("with controller having base route attribute", async () => {
        const app = await createApp();
        const base = Router();

        base.use(useController(RootController));
        app.use(base);

        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.body.data).toBe("get");
    }); 
});

@Route("/foo")
class FooController {
    @Get()
    getFoo(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "get" });
    }

    @Post()
    saveFoo(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "post" });
    }

    @Get("/1")
    @Get("/2")
    getFoo12(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: req.path });
    }   
    
    @Get(["/3", "/4"])
    getFoo34(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: req.path });
    }       

    @Get("/:id")
    getFooById(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: req.params.id });
    }
}

@Route()
class RootController {
    @Get()
    getData(req: Request, res: Response, next: NextFunction): void {
        res.json({ data: "get" });
    }
}