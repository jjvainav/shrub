import * as io from "socket.io";
import { createConfig, createService, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { HttpModule, IHttpServer } from "@shrub/http";

export const ISocketIOConfiguration = createConfig<ISocketIOConfiguration>();
export interface ISocketIOConfiguration extends io.Server {
}

export const ISocketIOServer = createService<ISocketIOServer>("socket.io-server");
export interface ISocketIOServer extends io.Server {
}

/** A module that creates and exposes a socket.io server attached to the currently registered http server. */
export class SocketIOModule implements IModule {
    readonly name = "socket.io";
    readonly dependencies = [HttpModule];

    initialize(init: IModuleInitializer): void {
        init.config(ISocketIOConfiguration).register(({ services }) => services.get(ISocketIOServer));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.registerSingleton(ISocketIOServer, { create: services => io(services.get(IHttpServer)) });
    }
}