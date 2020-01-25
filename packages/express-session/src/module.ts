import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IOptionsService } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { ExpressCookiesModule } from "@shrub/express-cookies";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { ICookieSessionOptions } from "./cookie-session";
import { cookieSession } from "./middleware";

export const IExpressSessionConfiguration = createConfig<IExpressSessionConfiguration>();
export interface IExpressSessionConfiguration {
    /** 
     * Enables cookie sessions with the specified options. Note: if options are not explicitly provided
     * the module will attempt to fetch options from the options service.
     */
    useCookieSession(options?: ICookieSessionOptions): void;
}

export class ExpressSessionModule implements IModule {
    private middleware?: RequestHandler;

    readonly name = "express-session";
    readonly dependencies = [
        ExpressCookiesModule,
        ExpressModule
    ];

    initialize({ config, settings }: IModuleInitializer): void {
        settings.bindToOptions(ICookieSessionOptions);
        config(IExpressSessionConfiguration).register(({ services }) => ({
            useCookieSession: options => {
                if (this.middleware) {
                    throw new Error("Cookie session has already been initialized.");
                }

                options = options || services.get(IOptionsService).getOptions(ICookieSessionOptions);
                this.middleware = cookieSession(options);
            }
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req: Request, res: Response, next: NextFunction) => {
            return this.middleware ? this.middleware(req, res, next) : next();
        });
    }
}