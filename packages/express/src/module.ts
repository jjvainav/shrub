import express from "express";
import { createConfig, createService, IModule, IModuleConfigurator, IModuleInitializer, IServiceRegistration, IServiceCollection } from "@shrub/core";
import { HttpModule, IHttpModuleConfiguration, IHttpServer } from "@shrub/http";
import { 
    IRequestContextBuilder, IRequestContextBuilderCallback, IRequestContextBuilderRegistration, IRequestContextService, 
    RequestContextBuilder, RequestContextBuilderRegistration, RequestContextService 
} from "./request-context";

export const IExpressConfiguration = createConfig<IExpressConfiguration>();
export interface IExpressConfiguration extends express.Application {
    /** 
     * Registers a callback to use with the IRequestBuilder; the name of the builder is used
     * as the name of the function that gets created on the IRequestBuilder and the callback
     * is the function that will get invoked internally when called by an external user.
     */
    useRequestBuilder(name: string, callback: IRequestContextBuilderCallback): void;
}

export const IExpressApplication = createService<IExpressApplication>("express-application");
export interface IExpressApplication extends express.Application {
}

export class ExpressModule implements IModule {
    readonly name = "express";
    readonly dependencies = [HttpModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressConfiguration).register(({ services }) => <IExpressConfiguration>services.get(IExpressApplication));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IRequestContextBuilderRegistration, RequestContextBuilderRegistration);
        registration.register(IRequestContextService, RequestContextService, { sealed: true });
        registration.register(IRequestContextBuilder, RequestContextBuilder, { sealed: true });
        
        registration.registerSingleton(IExpressApplication, {
            create: services => {
                const app = express();
                this.overrideListen(services, app);

                app.use((req, res, next) => {
                    // use a scoped service collection for the request
                    const requestServices = services.createScope();
                    const requestContextService = requestServices.get(IRequestContextService);
                    const requestContextBuilder = requestServices.get(IRequestContextBuilder);

                    res.on("finish", () => requestServices.dispose());

                    // note: these properties need to be configurable to support express sub apps
                    // when loading a set of modules as an independent sub app the root app will
                    // have defined a context on the request but for sub apps we need to overwrite
                    // it using the context configured for this specific domain
                    Object.defineProperty(req, "context", {
                        configurable: true,
                        get() { return requestContextService.context; }
                    });

                    Object.defineProperty(req, "contextBuilder", {
                        configurable: true,
                        get() { return requestContextBuilder; }
                    });

                    next();
                });

                // the express app gets returned as the express configuration object so add the extended
                // configuration functions to the express app here
                (<IExpressConfiguration>(<any>app)).useRequestBuilder = (name, callback) => {
                    services.get(IRequestContextBuilderRegistration).register(name, callback);
                };

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