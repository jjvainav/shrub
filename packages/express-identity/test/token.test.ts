import request from "supertest";
import { IAuthorizationOptions } from "../src/authorization";
import { ITokenOptions, tokenAuthentication } from "../src/token";
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
        const app = await createTestApp([handler], authorization);

        const response = await request(app)
            .get("/test")
            .set("Authorization", "Bearer " + token);

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("bearer-token");
    });

    test("authorize user from token in query string", async () => {
        const token = "my_token";
        const claims = { scope: ["read"] };
        const authorization: IAuthorizationOptions = {};
        const tokenOptions: ITokenOptions = { key: "token" };
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
        const app = await createTestApp([handler], authorization, tokenOptions);

        const response = await request(app).get("/test?token=" + token);

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
        const app = await createTestApp([handler], authorization);
        const response = await request(app).get("/test");

        expect(response.status).toBe(401);
    }); 

    test("with invalid/corrupt bearer token", async () => {
        const authorization: IAuthorizationOptions = {};
        const handler = tokenAuthentication({
            getScopes: () => [],
            verifyToken: (t, success, fail) => fail("Invalid token")
        });
        const app = await createTestApp([handler], authorization);

        const response = await request(app)
            .get("/test")
            .set("Authorization", "Bearer invalid");

        expect(response.status).toBe(401);
    }); 

    test("with multiple tokens", async () => {
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
        const app = await createTestApp([handler], authorization);

        const response = await request(app)
            .get("/test?access_token=" + token)
            .set("Authorization", "Bearer " + token);

        expect(response.status).toBe(400);
    });
});