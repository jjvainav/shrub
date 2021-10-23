import express from "express";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration, IServiceCollection } from "@shrub/core";
import { HttpModule, IHttpModuleConfiguration, IHttpServer } from "@shrub/http";
import { ControllerInvokerService, IControllerInvokerService } from "./controller-invoker";
import { IRequestContextService, requestContext, RequestContextService } from "./request-context";
import { IExpressApplication } from "./app";

export const IExpressConfiguration = createConfig<IExpressConfiguration>();
export interface IExpressConfiguration extends express.Application {
}

export class ExpressModule implements IModule {
    readonly name = "express";
    readonly dependencies = [HttpModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressConfiguration).register(({ services }) => <IExpressConfiguration>services.get(IExpressApplication));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerInvokerService, ControllerInvokerService);
        registration.register(IRequestContextService, RequestContextService, { sealed: true });
        registration.registerSingleton(IExpressApplication, {
            create: services => {
                const app = express();
                app.use(requestContext(services));
                this.overrideListen(services, app);
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