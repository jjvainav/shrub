import { IModule, IServiceRegistration } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { IControllerInvokerService, ControllerInvokerService } from "./invoker";

/** Express module that provides support for creating and using controller invokers. */
export class ExpressControllerInvokerModule implements IModule {
    readonly name = "express-controller-invoker";
    readonly dependencies = [ExpressModule];

    configureServices(registration: IServiceRegistration): void {
        registration.register(IControllerInvokerService, ControllerInvokerService);
    }
}