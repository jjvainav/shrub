import { Request, Response, NextFunction } from "express";
import * as zod from "zod";
import { ExpressFactory, IExpressApplication, IExpressConfiguration } from "@shrub/express";
import { ExpressZodModule } from "../src";

export interface ITestContextOptions {
    readonly shouldFail?: boolean;
}

interface ITestObject {
    readonly foo?: string;
}

const schema: zod.Schema<ITestObject> = zod.object({
    foo: zod.string()
});

export function createApp(options?: ITestContextOptions): Promise<IExpressApplication> {
    return ExpressFactory
        .useModules([{
            name: "Test",
            dependencies: [ExpressZodModule],
            configure: ({ config }) => {
                config.get(IExpressConfiguration).get(
                    "/test",
                    (req: Request, res: Response, next: NextFunction) => {
                        const obj: ITestObject = options && options.shouldFail ? { } : { foo: "test" };
                        
                        try {
                            const result = schema.parse(obj);
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