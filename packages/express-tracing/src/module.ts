import { IModule, IModuleConfigurator, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { TracingModule } from "@shrub/tracing";
import { addSpanRequestBuilder } from "./middleware";
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

    configure({ config }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).useRequestBuilder("addSpan", addSpanRequestBuilder);
    }
}