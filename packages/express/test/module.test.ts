import { createService } from "@shrub/core";
import request from "supertest";
import { ExpressFactory, ExpressModule, IExpressConfiguration, IRequestContext } from "../src";

const IScopedService = createService<IScopedService>("scoped-service");

interface IScopedService {
}

class ScopedService implements IScopedService {
    constructor() {
    }
}

describe("express module", () => {
    test("ensure request context is added to express request", async () => {
        let context: IRequestContext | undefined;
        const app = await ExpressFactory.useModules([{
            name: "test",
            dependencies: [ExpressModule],
            configure: ({ config }) => {
                config.get(IExpressConfiguration).use("/", (req, res, next) => {
                    context = req.context;
                    res.sendStatus(200);
                });
            }
        }])
        .create();

        await request(app).get("/");

        expect(context).toBeDefined();
        expect(context!.services).toBeDefined();
    });

    test("ensure request context uses a scoped service per request", async () => {
        const instances: IScopedService[] = [];
        const app = await ExpressFactory.useModules([{
            name: "test",
            dependencies: [ExpressModule],
            configureServices: registration => registration.registerScoped(IScopedService, ScopedService),
            configure: ({ config }) => {
                // add a couple middleware functions to capture an instance of the scoped service
                config.get(IExpressConfiguration).use((req, res, next) => {
                    instances.push(req.context.services.get(IScopedService));
                    next();
                });
                config.get(IExpressConfiguration).use("/", (req, res, next) => {
                    instances.push(req.context.services.get(IScopedService));
                    res.sendStatus(200);
                });
            }
        }])
        .create();

        // invoke the endpoint a couple of times to test the scoped service is a different instance
        await request(app).get("/");
        await request(app).get("/");

        expect(instances).toHaveLength(4);
        expect(instances[0]).toBe(instances[1]);
        expect(instances[2]).toBe(instances[3]);
        expect(instances[0]).not.toBe(instances[2]);
    });

    test("using express module as a sub-app", async () => {
        let rootContext: IRequestContext | undefined;
        let subContext: IRequestContext | undefined;

        const sub = await ExpressFactory.useModules([{
            name: "sub",
            dependencies: [ExpressModule],
            configure: ({ config }) => {
                config.get(IExpressConfiguration).use((req, res, next) => {
                    subContext = req.context;
                    res.sendStatus(200);
                });
            }
        }])
        .create();

        const root = await ExpressFactory.useModules([{
            name: "root",
            dependencies: [ExpressModule],
            configure: ({ config }) => {
                const app = config.get(IExpressConfiguration);
                app.use((req, res, next) => {
                    rootContext = req.context;
                    next();
                });

                app.use("/", sub);
            }
        }])
        .create();

        const response = await request(root).get("/");
        expect(response.status).toBe(200);

        expect(rootContext).toBeDefined();
        expect(rootContext!.services).toBeDefined();

        expect(subContext).toBeDefined();
        expect(subContext!.services).toBeDefined();

        expect(rootContext).not.toBe(subContext);
    });
});