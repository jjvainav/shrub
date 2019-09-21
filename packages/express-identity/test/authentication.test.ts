import request from "supertest";
import { sessionAuthentication } from "../src/authentication";
import { IAuthorizationOptions } from "../src/authorization";
import { createTestApp, ITestResponse, session } from "./app";

function encode(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64");
}

describe("session authentication", () => {
    test("authorize user from session", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = createTestApp([sessionAuthentication()], authorization);

        session.values["identity"] = encode({
            user: { id: "1" },
            auth: { scope: "read" }
        });

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("session");
        expect((<ITestResponse>response.body).auth.scope).toBe("read");
        expect((<ITestResponse>response.body).user.id).toBe("1");
    });

    test("unauthenticated request that redirects to login url without return to", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login");
    }); 
    
    test("unauthenticated request that redirects to login url with return to", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login",
            returnToUrlKey: "return_to"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login?return_to=%2Ftest");
    });   
    
    test("unauthenticated request that redirects to login url with complex return to", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login?state=1234",
            returnToUrlKey: "return_to"
        })],
        authorization);

        const response = await request(app).get("/test/sub?value=foo");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login?state=1234&return_to=%2Ftest%2Fsub%3Fvalue%3Dfoo");
    });

    test("unauthenticated request that redirects to login url with custom parameters", async () => {
        const authorization: IAuthorizationOptions = {
            challengeParameters: {
                v1: "foo",
                v2: "bar"
            }
        };
        const app = createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login",
            returnToUrlKey: "return_to"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login?v1=foo&v2=bar&return_to=%2Ftest");
    });    
});