import * as http from "http";
import { createConfig, createService, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";

export const IHttpModuleConfiguration = createConfig<IHttpModuleConfiguration>();
export interface IHttpModuleConfiguration {
    useRequestListener(requestListener: http.RequestListener): void;
}

export const IHttpServer = createService<IHttpServer>("http-server");
export interface IHttpServer extends http.Server {
}

export class HttpModule implements IModule {
    private requestListener?: http.RequestListener;
    private hasServer?: boolean;

    readonly name = "http";

    initialize(init: IModuleInitializer): void {
        init.config(IHttpModuleConfiguration).register(() => ({
            useRequestListener: listener => {
                if (this.hasServer) {
                    throw new Error("The HTTP server has already been created.");
                }

                this.requestListener = listener;
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        // only register if an IHttpServer has not already been registered
        registration.tryRegisterSingleton(IHttpServer, { 
            create: () => {
                this.hasServer = true;
                return http.createServer(this.requestListener);
            } 
        });
    }
}