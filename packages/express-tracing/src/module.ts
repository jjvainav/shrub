import { createConfig, IModule, IModuleConfigurator, IModuleInitializer, IOptionsService, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { TracingModule } from "@shrub/tracing";
import { IRequestTracingOptions, requestTracing } from "./middleware";
import { ExpressTracingService, IExpressTracingService } from "./service";

export const IExpressSessionConfiguration = createConfig<IExpressSessionConfiguration>();
export interface IExpressSessionConfiguration {
    /** 
     * Enables request tracing with the specified options. Note: if options are not explicitly provided
     * the module will attempt to fetch options from the options service.
     */
     useRequestTracing(options: IRequestTracingOptions): void;
}

export class ExpressTracingModule implements IModule {
    private options?: IRequestTracingOptions;

    readonly name = "express-tracing";
    readonly dependencies = [
        ExpressModule,
        TracingModule
    ];

    initialize({ config, settings }: IModuleInitializer): void {
        settings.bindToOptions(IRequestTracingOptions);
        config(IExpressSessionConfiguration).register(() => ({
            useRequestTracing: options => this.options = options
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IExpressTracingService, ExpressTracingService);
    }

    configure({ config, next, services }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req, res, next) => requestTracing(this.options)(req, res, next));
        // invoke next to allow modules downstream the ability to configure the request racing middleware
        next().then(() => this.options = this.options || services.get(IOptionsService).getOptions(IRequestTracingOptions));
    }
}