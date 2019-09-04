import { Application } from "express";
import { createConfigType, IModule, IModuleConfigurator, IModuleHost, IModuleInitializer } from "@shrub/module";
import { IServiceRegistration } from "@shrub/service-collection";
import { IExpressHost } from "./host";
import { ControllerRequestService, IControllerRequestService } from "./internal";
import { IRequestContext, IRequestContextService, RequestContextService } from "./request-context";

export const IExpressConfiguration = createConfigType<IExpressConfiguration>("express-core");
export interface IExpressConfiguration extends Application {
}

export class ExpressCoreModule implements IModule {
    private readonly host: IExpressHost;

    readonly name = "express-core";

    constructor(host: IModuleHost) {
        if (!this.isExpressHost(host)) {
            throw new Error("Express module requires an express host");
        }

        this.host = host;
    }    

    initialize(init: IModuleInitializer): void {
        init.config(IExpressConfiguration).register(() => this.host.app);
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerRequestService, ControllerRequestService);
        registration.register(IRequestContextService, RequestContextService);
    }

    configure({ services }: IModuleConfigurator): void {
        this.host.app.use((req, res, next) => {
            const context: IRequestContext = {
                bag: {},
                services
            };

            (<any>req.context) = context;

            next();
        });
    } 

    private isExpressHost(host: IModuleHost): host is IExpressHost {
        return (<IExpressHost>host).app !== undefined;
    }     
}