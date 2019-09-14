import * as express from "express";
import * as http from "http";
import { createConfig, createService, IModule, IModuleInitializer, IServiceRegistration, SingletonServiceFactory } from "@shrub/core";
import { HttpModule, IHttpServer } from "@shrub/http";
import { ControllerRequestService, IControllerRequestService } from "./internal";
import { IRequestContext, IRequestContextService, RequestContextService } from "./request-context";

export const IExpressConfiguration = createConfig<IExpressConfiguration>();
export interface IExpressConfiguration extends express.Application {
}

export const IExpressServer = createService<IExpressServer>("express-server");
export interface IExpressServer extends IHttpServer {
    readonly app: express.Application;
}

export class ExpressModule implements IModule {
    readonly name = "express";
    readonly dependencies = [HttpModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressConfiguration).register(({ services }) => services.get(IExpressServer).app);
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerRequestService, ControllerRequestService);
        registration.register(IRequestContextService, RequestContextService);
        
        const factory = new SingletonServiceFactory<IExpressServer>({
            create: services => {
                const app = express();
                const server = http.createServer(app);

                app.use((req, res, next) => {
                    const context: IRequestContext = {
                        bag: {},
                        services
                    };
        
                    (<any>req.context) = context;
        
                    next();
                });

                (<any>server).app = app;
                return <IExpressServer>server;
            }
        });

        registration.registerSingleton(IHttpServer, factory);
        registration.registerSingleton(IExpressServer, factory);
    }
}