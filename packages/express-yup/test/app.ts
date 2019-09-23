import { Request, Response, NextFunction } from "express";
import * as yup from "yup";
import { ExpressFactory, IExpressApplication, IExpressConfiguration } from "@shrub/express";
import { ExpressYupModule } from "../src";

export interface ITestContextOptions {
    readonly shouldFail?: boolean;
}

interface ITestObject {
    readonly foo?: string;
}

const schema = yup.object<ITestObject>({
    foo: yup.string().required()
});

export function createApp(options?: ITestContextOptions): Promise<IExpressApplication> {
    return ExpressFactory
        .useModules([{
            name: "Test",
            dependencies: [ExpressYupModule],
            configure: ({ config }) => {
                config.get(IExpressConfiguration).get(
                    "/test",
                    (req: Request, res: Response, next: NextFunction) => {
                        const obj: ITestObject = options && options.shouldFail ? { } : { foo: "test" };
                        schema.validate(obj)
                            .then(result => res.status(200).json(result))
                            .catch(next);
                    });
            }
        }])
        .create();
}