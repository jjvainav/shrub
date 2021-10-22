import { NextFunction, Request, Response, Router } from "express";
import request from "supertest";
import { controller, ExpressFactory, Get, Post, Route } from "../src";

describe("controller middleware", () => {
    test("with basic GET handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response = await request(app).get("/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("get");
    });

    test("with basic POST handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response = await request(app).post("/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("post");
    });

    test("with async handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(AsyncController));

        const response = await request(app).get("/async");

        expect(response.status).toBe(200);
        expect(response.body.value).toBe("hello");
    });

    test("with async handler that throws", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(AsyncController));
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json({ error: true });
        });

        const response = await request(app).get("/async/throw");

        expect(response.status).toBe(500);
        expect(response.body.error).toBe(true);
    });

    test("with GET handler for path containing parameter", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response = await request(app).get("/foo/123");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("123");
    });

    test("with GET handler and custom request handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response = await request(app).get("/foo/handler");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("bar");
        expect(response.header.foo).toBe("bar");
    });

    test("with multiple Get decorators for the same handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response1 = await request(app).get("/foo/1");
        const response2 = await request(app).get("/foo/2");

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        expect(response1.body.foo).toBe("/1");
        expect(response2.body.foo).toBe("/2");
    });

    test("with multiple routes for the same handler", async () => {
        const app = await ExpressFactory.create();
        app.use(controller(FooController));

        const response1 = await request(app).get("/foo/3");
        const response2 = await request(app).get("/foo/4");

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        expect(response1.body.foo).toBe("/3");
        expect(response2.body.foo).toBe("/4");
    });

    test("with base router", async () => {
        const app = await ExpressFactory.create();
        const base = Router();

        base.use("/base", controller(FooController));
        app.use(base);

        const response = await request(app).get("/base/foo");

        expect(response.status).toBe(200);
        expect(response.body.foo).toBe("get");
    }); 
    
    test("with controller having base route attribute", async () => {
        const app = await ExpressFactory.create();
        const base = Router();

        base.use(controller(RootController));
        app.use(base);

        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.body.data).toBe("get");
    }); 
});

function customRequestHandler(req: Request, res: Response, next: NextFunction): void {
    res.setHeader("foo", "bar");
    next();
}

function timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

@Route("/async")
class AsyncController {
    @Get()
    async getFoo(req: Request, res: Response, next: NextFunction): Promise<void> {
        await timeout(1);
        res.json({ value: "hello" });
    }

    @Get("/throw")
    async getFooThatThrows(req: Request, res: Response, next: NextFunction): Promise<void> {
        await timeout(1);
        throw new Error("Test");
    }
}

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

    @Get("/handler", customRequestHandler)
    getFooWithCustomRequestHandler(req: Request, res: Response, next: NextFunction): void {
        res.json({ foo: "bar" });
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