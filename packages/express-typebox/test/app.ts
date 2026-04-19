import { Request, Response, NextFunction } from "express";
import Type from "typebox";
import Schema from "typebox/schema";
import { ExpressFactory, IExpressApplication, IExpressConfiguration } from "@shrub/express";
import { ExpressTypeboxModule } from "../src";

export interface ITestContextOptions {
    readonly shouldFail?: boolean;
}

type TestObject = Type.Static<typeof TestObject>
const TestObject = Type.Object({
  foo: Type.Readonly(Type.String())
});
const TestObjectValidator = Schema.Compile(TestObject);

export function createApp(options?: ITestContextOptions): Promise<IExpressApplication> {
    return ExpressFactory
        .useModules([{
            name: "Test",
            dependencies: [ExpressTypeboxModule],
            configure: ({ config }) => {
                config.get(IExpressConfiguration).get(
                    "/test",
                    (req: Request, res: Response, next: NextFunction) => {
                        const obj = options && options.shouldFail ? { } : { foo: "test" };
                        
                        try {
                            const result = TestObjectValidator.Parse(obj);
                            res.status(200).json(result);
                        }
                        catch (err) {
                            next(err);
                        }
                    });
            }
        }])
        .create();
}