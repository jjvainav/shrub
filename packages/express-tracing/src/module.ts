import { IModule, IServiceRegistration } from "@shrub/core";
import { ExpressModule } from "@shrub/express";
import { TracingModule } from "@shrub/tracing";
import { ExpressTracingService, IExpressTracingService } from "./service";

export class ExpressTracingModule implements IModule {
    readonly name = "express-tracing";
    readonly dependencies = [
        ExpressModule,
        TracingModule
    ];

    configureServices(registration: IServiceRegistration): void {
        registration.register(IExpressTracingService, ExpressTracingService);
    }
}