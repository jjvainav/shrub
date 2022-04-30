import { ExpressFactory } from "../src";

describe("express factory", () => {
    test("create multiple instances", async () => {
        const factory = new ExpressFactory();

        const app1 = await factory.create();
        const app2 = await factory.create();

        expect(app1).not.toBe(app2);
    });

    test("dispose app and ensure modules are disposed", async () => {
        let flag = false;
        const app = await new ExpressFactory().useModules([{
            name: "test",
            dispose: () => {
                flag = true;
                return Promise.resolve();
            }
        }])
        .create();

        await app.dispose();

        expect(flag).toBe(true);
    });

    test("load multiple settings objects", async () => {
        let result: any;
        const factory = new ExpressFactory().useModules([{
            name: "test",
            configure: ({ settings }) => {
                result = settings;
            }
        }]);

        factory.useSettings({ test: { foo: "foo" } });
        factory.useSettings({ test: { foo: "bar" } });

        await factory.create();

        expect(result.foo).toBe("bar");
    });
});