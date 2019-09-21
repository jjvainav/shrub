import createError from "http-errors";
import request from "supertest";
import { createTestApp, ITestResponse } from "./app";

describe("identity", () => {
    test("identity middleware with authenticated user", async () => {
        const app = createTestApp([{
            scheme: "test",
            authenticate: (req, result) => result.success({ id: "1" }, { scope: "read" })
        }]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("test");
        expect((<ITestResponse>response.body).auth.scope).toBe("read");
        expect((<ITestResponse>response.body).user.id).toBe("1");
    });

    test("identity middleware with no authentication handlers", async () => {
        const app = createTestApp([]);
        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(false);
        expect((<ITestResponse>response.body).scheme).toBeUndefined();
        expect((<ITestResponse>response.body).auth).toBeUndefined();
        expect((<ITestResponse>response.body).user).toBeUndefined();
    });

    test("identity middleware with authentication handler that fails", async () => {
        const app = createTestApp([{
            scheme: "test",
            authenticate: (req, result) => result.fail("Testing"),
            challenge: (req, result) => result.send(createError(400))
        }]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(400);
    });    

    test("identity middleware with multiple authentication handlers", async () => {
        const app = createTestApp([
            {
                scheme: "foo",
                authenticate: (req, result) => result.skip()
            },
            {
                scheme: "bar",
                authenticate: (req, result) => result.success({ id: "1" }, { scope: "read" })
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("bar");
        expect((<ITestResponse>response.body).auth.scope).toBe("read");
        expect((<ITestResponse>response.body).user.id).toBe("1");
    });

    test("identity middleware with multiple authentication handlers that all succeed", async () => {
        const app = createTestApp([
            {
                scheme: "foo",
                authenticate: (req, result) => result.success({ id: "1" }, { scope: "read" })
            },
            {
                scheme: "bar",
                authenticate: (req, result) => result.success({ id: "2" }, { scope: "write" })
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        // the first one to succeed wins
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("foo");
        expect((<ITestResponse>response.body).auth.scope).toBe("read");
        expect((<ITestResponse>response.body).user.id).toBe("1");
    });    

    test("identity middleware with multiple authentication handlers that all skip", async () => {
        const app = createTestApp([
            {
                scheme: "foo",
                authenticate: (req, result) => result.skip()
            },
            {
                scheme: "bar",
                authenticate: (req, result) => result.skip()
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(false);
        expect((<ITestResponse>response.body).scheme).toBeUndefined();
        expect((<ITestResponse>response.body).auth).toBeUndefined();
        expect((<ITestResponse>response.body).user).toBeUndefined();
    });    
});