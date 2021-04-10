import request from "supertest";
import { ExpressFactory, ExpressModule, IExpressConfiguration, IRequestContext } from "../src";

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