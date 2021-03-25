import request from "supertest";
import { IAuthorizationOptions } from "../src/authorization";
import { sessionAuthentication } from "../src/session";
import { createTestApp, ITestResponse, session } from "./app";

function encode(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64");
}

describe("session authentication", () => {
    test("authorize user from session", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([sessionAuthentication()], authorization);

        session.values["identity"] = encode({
            claims: { id: "1", scope: "read" }
        });

        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("session");
        expect((<ITestResponse>response.body).claims.id).toBe("1");
        expect((<ITestResponse>response.body).claims.scope).toBe("read");
    });

    test("unauthenticated request that redirects to login url without return to", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login");
    }); 
    
    test("unauthenticated request that redirects to login url with return to", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([sessionAuthentication({
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
        const app = await createTestApp([sessionAuthentication({
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
        const app = await createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login",
            returnToUrlKey: "return_to"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login?v1=foo&v2=bar&return_to=%2Ftest");
    });  
    
    test("unauthenticated request that redirects to login using relative url path", async () => {
        const authorization: IAuthorizationOptions = {
            challengeParameters: {
                v1: "foo",
                v2: "bar"
            }
        };
        const app = await createTestApp([sessionAuthentication({
            failureRedirectUrl: "/login",
            returnToUrlKey: "return_to"
        })],
        authorization);

        const response = await request(app).get("/test");

        expect(response.status).toBe(302);
        expect(response.header.location).toBe("/login?v1=foo&v2=bar&return_to=%2Ftest");
    });
    
    test("log user into session", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([sessionAuthentication()], authorization);

        // first log the user into a session using the login end-point
        const login = await request(app).post("/login?id=1&scope=read");
        expect(login.status).toBe(200);

        // the identity info gets stored in the 'identity' session value
        expect(session.values["identity"]).toBeDefined();

        // next, invoke a secure endpoint to verify the login was successful
        const response = await request(app).get("/test");

        expect(response.status).toBe(200);
        expect((<ITestResponse>response.body).isAuthenticated).toBe(true);
        expect((<ITestResponse>response.body).scheme).toBe("session");
        expect((<ITestResponse>response.body).claims.id).toBe("1");
        expect((<ITestResponse>response.body).claims.scope).toBe("read");
    });

    test("log user out of session", async () => {
        const authorization: IAuthorizationOptions = {};
        const app = await createTestApp([sessionAuthentication({
            failureRedirectUrl: "http://localhost/login"
        })],
        authorization);

        // log the user into a session using the login end-point
        const login = await request(app).post("/login?id=1&scope=read");
        expect(login.status).toBe(200);

        // log the user out of the user session
        const logout = await request(app).post("/logout");
        expect(logout.status).toBe(200);

        // test that the session has been logged out
        const response = await request(app).get("/test");
        expect(response.status).toBe(302);
        expect(response.header.location).toBe("http://localhost/login");

        // verify the session has not been deleted but that the identity info has been removed
        // note: sessions are anonymous so the session itself should still exist
        expect(session.isDeleted).toBeFalsy();
        expect(session.values["identity"]).toBeUndefined();
    });    
});