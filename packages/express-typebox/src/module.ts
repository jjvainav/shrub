import { IModule, IModuleConfigurator } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { NextFunction, Request, Response } from "express";
import Schema from "typebox/schema";
import { sendErrors, typeboxMiddleware } from "./middleware";

export class ExpressTypeboxModule implements IModule {
    readonly name = "express-typebox";
    readonly dependencies = [ExpressModule];

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        const express = config.get(IExpressConfiguration);
        express.use((req, res, next) => typeboxMiddleware()(req, res, next));

        await next();
        
        express.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (err instanceof Schema.ParseError) {
                sendErrors(res, err.errors);
            }
            else {
                next(err);
            }
        });
    } 
}