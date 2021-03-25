import request from "supertest";
import { IAuthorizationOptions } from "../src/authorization";
import { createTestApp } from "./app";

describe("authorization", () => {
    test("authorize authenticated user", async () => {
        // pass an empty authorization options so that the createTestApp function will inject the
        // useAuthorization route middleware - by default this will simply ensure a user has been authenticated
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.success({ id: "1", scope: "read" })
        }],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
    });

    test("authorize authenticated user with custom verification", async () => {
        const authorization: IAuthorizationOptions = {
            verify: context => Promise.resolve(context.claims.scope === "read")
        };
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.success({ id: "1", scope: "read" })
        }],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
    });   
    
    test("authorize authenticated user with custom verification that fails", async () => {
        const authorization: IAuthorizationOptions = {
            verify: context => Promise.resolve(context.claims.scope === "write")
        };
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.success({ id: "1", scope: "read" })
        }],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(403);
    });       

    test("unauthenticated request should fail authorization", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([{
            scheme: "test",
            authenticate: (context, result) => result.skip()
        }],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(401);
    });    
});