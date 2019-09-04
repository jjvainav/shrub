import Cookies from "cookies";
import { ExpressCoreModule, IExpressConfiguration } from "@shrub/express-core";
import { IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/module";
import { createOptions, IOptionsService } from "@shrub/service-collection";
import { cookies } from "./middleware";

export const ICookiesOptions = createOptions<ICookiesOptions>("cookies-middleware");

export interface ICookiesOptions {
    // TODO: look into using keygrip to secure the cookie: https://www.npmjs.com/package/keygrip
    readonly keys: string[]; // readonly keys: string[] | keygrip;
}

/** Express module that provides cookie middleware using the cookies library: https://github.com/pillarjs/cookies. */
export class ExpressCookiesModule implements IModule {
    readonly name = "express-cookies";
    readonly dependencies = [ExpressCoreModule];

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(ICookiesOptions);
    }

    configure({ config, services }: IModuleConfigurator): void {
        const options = services.get(IOptionsService).getOptions(ICookiesOptions);
        config.get(IExpressConfiguration).use(Cookies.express(options.keys));
        config.get(IExpressConfiguration).use(cookies);
    }
}