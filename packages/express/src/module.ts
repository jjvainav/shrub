import * as express from "express";
import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration, IServiceCollection } from "@shrub/core";
import { HttpModule, IHttpModuleConfiguration, IHttpServer } from "@shrub/http";
import { ControllerRequestService, IControllerRequestService } from "./internal";
import { IRequestContext, IRequestContextService, RequestContextService } from "./request-context";

export const IExpressConfiguration = createConfig<IExpressConfiguration>();
export interface IExpressConfiguration extends express.Application {
}

export const IExpressApplication = createService<IExpressApplication>("express-application");
export interface IExpressApplication extends express.Application {
}

export class ExpressModule implements IModule {
    readonly name = "express";
    readonly dependencies = [HttpModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressConfiguration).register(({ services }) => services.get(IExpressApplication));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerRequestService, ControllerRequestService);
        registration.register(IRequestContextService, RequestContextService);
        registration.registerSingleton(IExpressApplication, {
            create: services => {
                const app = express();
                this.overrideListen(services, app);

                app.use((req, res, next) => {
                    const context: IRequestContext = {
                        bag: {},
                        services
                    };
        
                    (<any>req.context) = context;
        
                    next();
                });

                return app;
            }
        });
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IHttpModuleConfiguration).useRequestListener(services.get(IExpressApplication));
    }

    private overrideListen(services: IServiceCollection, app: express.Express): void {
        // The express.listen function creates a new http.Server so this overrides
        // that logic to return the instance of the http.Server created by the http module.
        // This also assumes the express app defined by this module has already been
        // registered as the request listener.
        app.listen = function listen() {
            const server: any = services.get(IHttpServer);
            return server.listen.apply(server, arguments);
        }
    }
}