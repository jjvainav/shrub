import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { ClientFactory, IClientType } from "./client";
import { IProxy, IProxyType, ProxyClient, ProxyFactory } from "./proxy";

export const IExpressGatewayConfiguration = createConfig<IExpressGatewayConfiguration>();
export interface IExpressGatewayConfiguration {
    /** Registers a client type and factory. */
    useClient<TClient>(clientType: IClientType<TClient>, factory: ClientFactory<TClient>): void;
    /** Registers a proxy type and factory. */
    useProxy<TProxy extends IProxy<TClient>, TClient = ProxyClient<TProxy>>(proxyType: IProxyType<TProxy, TClient>, factory: ProxyFactory<TProxy, TClient>): void;
}

/** Express module that provides support for configuring Api clients and proxies. */
export class ExpressGatewayModule implements IModule {
    readonly name = "express-gateway";
    readonly dependencies = [ExpressModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressGatewayConfiguration).register(() => ({
            useClient: (clientType, factory) => clientType.configure({ factory }),
            useProxy: (proxyType, factory) => proxyType.configure({ factory })
        }));
    }
}