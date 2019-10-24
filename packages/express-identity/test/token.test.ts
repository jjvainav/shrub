import request from "supertest";
import { IAuthorizationOptions } from "../src/authorization";
import { tokenAuthentication } from "../src/token";
import { createTestApp, ITestResponse } from "./app";

describe("token authentication", () => {
    test("authorize user from bearer token", async () => {
        const token = "my_token";
        const claims = { scope: ["read"] };
        const authorization: IAuthorizationOptions = {};
        const handler = tokenAuthentication({
            getScopes: claims => claims.scope,
            verifyToken: (t, success, fail) => {
                if (t === token) {
                    success(claims);
                }
                else {
                    fail("Invalid token");
                }
            }
        });
        const app = createTestApp([handler], authorization);

        const response = await request(app)
            .get("/test")
            .set("Authorization", "Bearer " + token);

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("bearer-token");
    });

    test("with request missing authorization header", async () => {
        const authorization: IAuthorizationOptions = {};
        const handler = tokenAuthentication({
            getScopes: () => [],
            verifyToken: () => { /* shouldn't get here */ }
        });
        const app = createTestApp([handler], authorization);
        const response = await request(app).get("/test");

        expect(response.status).toBe(401);
    }); 

    test("with invalid/corrupt bearer token", async () => {
        const authorization: IAuthorizationOptions = {};
        const handler = tokenAuthentication({
            getScopes: () => [],
            verifyToken: (t, success, fail) => fail("Invalid token")
        });
        const app = createTestApp([handler], authorization);

        const response = await request(app)
            .get("/test")
            .set("Authorization", "Bearer invalid");

        expect(response.status).toBe(401);
    });      
});