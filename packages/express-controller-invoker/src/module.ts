import { createConfig, IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressApplication } from "@shrub/express";
import { RequestHandler } from "express";
import { 
    ControllerInvokerConstructor, IControllerInvokerRegistrationService, IControllerInvokerService, 
    IControllerInvokerType, ControllerInvokerRegistrationService, ControllerInvokerService 
} from "./invoker";

export const IExpressControllerInvokerConfiguration = createConfig<IExpressControllerInvokerConfiguration>();
export interface IExpressControllerInvokerConfiguration {
    /** Registers a controller invoker type and factory. */
    //useControllerInvoker<T>(invokerType: IControllerInvokerType<T>, factory: IControllerInvokerFactory<T>): void;

    /** Registers a controller invoker */
    useControllerInvoker<T>(invokerType: IControllerInvokerType<T>, ctor: ControllerInvokerConstructor<T>, handler?: RequestHandler): void;
}

/** Express module that provides support for registering and using controller invokers. */
export class ExpressControllerInvokerModule implements IModule {
    readonly name = "express-controller-invoker";
    readonly dependencies = [ExpressModule];

    initialize(init: IModuleInitializer): void {
        init.config(IExpressControllerInvokerConfiguration).register(({ services }) => ({
            useControllerInvoker: (invokerType, ctor, handler) => services.get(IControllerInvokerRegistrationService).registerControllerInvoker(invokerType.key, () => new ctor({
                app: services.get(IExpressApplication),
                handler
            }))
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerInvokerRegistrationService, ControllerInvokerRegistrationService);
        registration.register(IControllerInvokerService, ControllerInvokerService);
    }
}