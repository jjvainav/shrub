import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IProxyType } from "./proxy";

export const IExpressProxyConfiguration = createConfig<IExpressProxyConfiguration>();
export interface IExpressProxyConfiguration {
    /** Registers a proxy type and factory. */
    useProxy<T>(proxyType: IProxyType<T>, factory: () => T): void;
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