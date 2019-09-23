import { NextFunction, Request, Response } from "express";
import * as yup from "yup";
import { IModule, IModuleConfigurator } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";

export class ExpressYupModule implements IModule {
    readonly name = "express-yup";
    readonly dependencies = [ExpressModule];

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();
        config.get(IExpressConfiguration).use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (yup.ValidationError.isError(err)) {
                res.status(400).json({
                    message: err.errors.join(" ")
                });
            }
            else {
                next(err);
            }
        });
    } 
}