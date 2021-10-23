import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IProxy, IProxyType } from "./proxy";

export const IExpressProxyConfiguration = createConfig<IExpressProxyConfiguration>();
export interface IExpressProxyConfiguration {
    /** Registers a proxy type and factory. */
    useProxy<TClient, TProxy extends IProxy<TClient>>(proxyType: IProxyType<TClient, TProxy>, factory: () => TProxy): void;
}

/** Express module that provides support for configuring proxies. */
export class ExpressProxyModule implements IModule {
    readonly name = "express-proxy";
    readonly dependencies = [ExpressModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressProxyConfiguration).register(() => ({
            useProxy: (proxyType, factory) => proxyType.configure({ factory })
        }));
    }
}