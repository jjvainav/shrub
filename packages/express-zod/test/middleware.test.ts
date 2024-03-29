import { NextFunction, Request, Response } from "express";
import request from "supertest";
import { createApp } from "./app";

describe("express zod middleware", () => {
    test("with request that throws zod validation error", async () => {
        const app = await createApp({ shouldFail: true });
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.log(err);
            next(err);
        });

        const result = await request(app).get("/test");

        expect(result.status).toBe(400);
        expect(result.body.message).toBe("foo - Required");
    });
});