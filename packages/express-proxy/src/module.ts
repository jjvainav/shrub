import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IProxyFactory, IProxyRegistrationService, IProxyService, IProxyType, ProxyRegistrationService, ProxyService } from "./proxy";

export const IExpressProxyConfiguration = createConfig<IExpressProxyConfiguration>();
export interface IExpressProxyConfiguration {
    /** Registers a proxy type and factory. */
    useProxy<T>(proxyType: IProxyType<T>, factory: IProxyFactory<T>): void;
}

/** Express module that provides support for registering and using request proxies. */
export class ExpressProxyModule implements IModule {
    readonly name = "express-proxy";
    readonly dependencies = [ExpressModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressProxyConfiguration).register(({ services }) => ({
            useProxy: (proxyType, factory) => services.get(IProxyRegistrationService).registerProxy(proxyType.key, factory)
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IProxyRegistrationService, ProxyRegistrationService);
        registration.register(IProxyService, ProxyService);
    }
}