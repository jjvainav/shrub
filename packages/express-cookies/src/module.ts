import Cookies from "cookies";
import { createOptions, IModule, IModuleConfigurator, IModuleInitializer, IOptionsService } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { addCookiesRequestBuilder, cookies } from "./middleware";

export const ICookiesOptions = createOptions<ICookiesOptions>("cookies-middleware");
export interface ICookiesOptions {
    // TODO: look into using keygrip to secure the cookie: https://www.npmjs.com/package/keygrip
    readonly keys: string[]; // readonly keys: string[] | keygrip;
}

/** Express module that provides cookie middleware using the cookies library: https://github.com/pillarjs/cookies. */
export class ExpressCookiesModule implements IModule {
    readonly name = "express-cookies";
    readonly dependencies = [ExpressModule];

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(ICookiesOptions);
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).useRequestBuilder("addCookies", addCookiesRequestBuilder);

        const options = services.get(IOptionsService).getOptions(ICookiesOptions);
        config.get(IExpressConfiguration).use(Cookies.express(options.keys));
        config.get(IExpressConfiguration).use(cookies);
    }
}