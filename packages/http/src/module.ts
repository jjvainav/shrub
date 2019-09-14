import * as http from "http";
import { createConfig, createService, IModule, IServiceRegistration } from "@shrub/core";

export const IHttpModuleConfiguration = createConfig<IHttpModuleConfiguration>();
export interface IHttpModuleConfiguration {
    useRequestListener(requestListener: http.RequestListener): void;
}

export const IHttpServer = createService<IHttpServer>("http-server");
export interface IHttpServer extends http.Server {
}

export class HttpModule implements IModule {
    readonly name = "http";

    configureServices(registration: IServiceRegistration): void {
        registration.registerSingleton(IHttpServer, { create: () => http.createServer() });
    }
}