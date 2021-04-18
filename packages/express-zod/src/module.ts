import { NextFunction, Request, Response } from "express";
import * as zod from "zod";
import { IModule, IModuleConfigurator } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";

function getErrorMessage(error: zod.ZodError): string {
    const messages: string[] = [];
    const errors = error.flatten();

    for (const key of Object.keys(errors.fieldErrors)) {
        for (const err of errors.fieldErrors[key]) {
            messages.push(`${key}: ${toLower(err)}`);
        }
    }

    messages.push(...errors.formErrors);

    return messages.join("\n");
}

function toLower(value: string): string {
    return value.charAt(0).toLowerCase() + value.slice(1);
}

export class ExpressZodModule implements IModule {
    readonly name = "express-zod";
    readonly dependencies = [ExpressModule];

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();
        config.get(IExpressConfiguration).use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (err instanceof zod.ZodError) {
                res.status(400).json({ message: getErrorMessage(err) });
            }
            else {
                next(err);
            }
        });
    } 
}