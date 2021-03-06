import createError from "http-errors";
import request from "supertest";
import { createTestApp, ITestResponse } from "./app";

describe("identity", () => {
    test("identity middleware with authenticated user", async () => {
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.success({ id: "1", scope: "read" })
        }]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("test");
        expect((<ITestResponse>response.body).claims.id).toBe("1");
        expect((<ITestResponse>response.body).claims.scope).toBe("read");
    });

    test("identity middleware with no authentication handlers", async () => {
        const app = await createTestApp([]);
        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(false);
        expect((<ITestResponse>response.body).scheme).toBeUndefined();
        expect((<ITestResponse>response.body).claims).toBeUndefined();
    });

    test("identity middleware with authentication handler that fails", async () => {
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.fail("Testing"),
            challenge: (context, result) => result.send(createError(400))
        }]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(400);
    });    

    test("identity middleware with multiple authentication handlers", async () => {
        const app = await createTestApp([
            {
                scheme: "foo",
                authenticate: (context, result) => result.skip()
            },
            {
                scheme: "bar",
                authenticate: (context, result) => result.success({ id: "1", scope: "read" })
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("bar");
        expect((<ITestResponse>response.body).claims.id).toBe("1");
        expect((<ITestResponse>response.body).claims.scope).toBe("read");
    });

    test("identity middleware with multiple authentication handlers that all succeed", async () => {
        const app = await createTestApp([
            {
                scheme: "foo",
                authenticate: (context, result) => result.success({ id: "1", scope: "read" })
            },
            {
                scheme: "bar",
                authenticate: (context, result) => result.success({ id: "2", scope: "write" })
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        // the first one to succeed wins
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("foo");
        expect((<ITestResponse>response.body).claims.id).toBe("1");
        expect((<ITestResponse>response.body).claims.scope).toBe("read");
    });    

    test("identity middleware with multiple authentication handlers that all skip", async () => {
        const app = await createTestApp([
            {
                scheme: "foo",
                authenticate: (context, result) => result.skip()
            },
            {
                scheme: "bar",
                authenticate: (context, result) => result.skip()
            }
        ]);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(false);
        expect((<ITestResponse>response.body).scheme).toBeUndefined();
        expect((<ITestResponse>response.body).claims).toBeUndefined();
    });    
});