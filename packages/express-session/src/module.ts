import { NextFunction, Request, Response } from "express";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { ExpressCookiesModule } from "@shrub/express-cookies";
import { IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/module";
import { IOptionsService } from "@shrub/service-collection";
import { ICookieSessionOptions } from "./cookie-session";
import { cookieSession } from "./middleware";

export class ExpressSessionModule implements IModule {
    readonly name = "express-session";
    readonly dependencies = [
        ExpressCookiesModule,
        ExpressModule
    ];

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(ICookieSessionOptions);
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req: Request, res: Response, next: NextFunction) => {
            const options = services.get(IOptionsService).getOptions(ICookieSessionOptions);
            return cookieSession(options)(req, res, next);
        });
    }
}