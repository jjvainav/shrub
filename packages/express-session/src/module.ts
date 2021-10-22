import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IOptionsService } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { ExpressCookiesModule } from "@shrub/express-cookies";
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
    private options?: ICookieSessionOptions;

    readonly name = "express-session";
    readonly dependencies = [
        ExpressCookiesModule,
        ExpressModule
    ];

    initialize({ config, settings }: IModuleInitializer): void {
        settings.bindToOptions(ICookieSessionOptions);
        config(IExpressSessionConfiguration).register(() => ({
            useCookieSession: options => this.options = options
        }));
    }

    configure({ config, next, services }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req, res, next) => cookieSession(this.options || {})(req, res, next));
        // invoke next to allow modules downstream the ability to configure the cookie session middleware
        next().then(() => this.options = this.options || services.get(IOptionsService).getOptions(ICookieSessionOptions));
    }
}