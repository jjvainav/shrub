import express from "express";
import createError from "http-errors";
import request from "supertest";
import { errorHandler } from "../src/middleware";

function createTestApp(): express.Express {
    const app = express();
    const router = express.Router();

    router.get("/test", (req, res, next) => {
        next(createError(401, "Unauthorized."));
    });

    router.get("/test2", (req, res, next) => {
        next(new createError.Unauthorized());
    });

    app.use(router);
    app.use(errorHandler);

    return app;
}

describe("http errors middleware", () => {
    test("create error object instance from factory method", async () => {
        const app = createTestApp();
        const response = await request(app).get("/test");
        expect(response.status).toBe(401);
    });

    test("create error object instance from constructor", async () => {
        const app = createTestApp();
        const response = await request(app).get("/test2");
        expect(response.status).toBe(401);
    });     
});