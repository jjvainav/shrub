import { IModule, IModuleInitializer, IServiceRegistration } from "@shrub/core";
import { IModelService, IModelServiceOptions, ModelService } from "./service";

export class ModelModule implements IModule {
    readonly name = "model";
    readonly dependencies = [];

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(IModelServiceOptions);
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IModelService, ModelService);
    }
}