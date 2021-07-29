import { IModule, IModuleConfigurator } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { NextFunction, Request, Response } from "express";
import * as zod from "zod";

export class ExpressZodModule implements IModule {
    readonly name = "express-zod";
    readonly dependencies = [ExpressModule];

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();
        config.get(IExpressConfiguration).use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (err instanceof zod.ZodError) {
                res.status(400).json({ message: err.message });
            }
            else {
                next(err);
            }
        });
    } 
}