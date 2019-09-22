import { IModule, IModuleConfigurator } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { errorHandler } from "./middleware";

export class ExpressHttpErrorsModule implements IModule {
    readonly name = "express-http-errors";
    readonly dependencies = [ExpressModule];

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();
        config.get(IExpressConfiguration).use(errorHandler);
    } 
}