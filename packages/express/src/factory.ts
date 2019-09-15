import { IModuleSettingsCollection, IServiceRegistration, ModuleInstanceOrConstructor, ModuleLoader } from "@shrub/core";
import { ExpressModule, IExpressApplication } from "./module";

/** A factory class for registering modules within an Express application context. */
export class ExpressFactory {
    private readonly loader = new ModuleLoader().useModules([ExpressModule]);

    /** Creates an express application. */
    static create(): Promise<IExpressApplication> {
        return new ExpressFactory().create();
    }

    static configureServices(callback: (registration: IServiceRegistration) => void): ExpressFactory {
        return new ExpressFactory().configureServices(callback);
    }

    static useModules(modules: ModuleInstanceOrConstructor[]): ExpressFactory {
        return new ExpressFactory().useModules(modules);
    }

    static useSettings(settings: IModuleSettingsCollection): ExpressFactory {
        return new ExpressFactory().useSettings(settings);
    }

    /** Loads registered modules and returns an instance of the configured express application. */
    create(): Promise<IExpressApplication> {
        return this.loader.load().then(modules => modules.services.get(IExpressApplication));
    }

    configureServices(callback: (registration: IServiceRegistration) => void): this {
        this.loader.configureServices(callback);
        return this;
    }

    useModules(modules: ModuleInstanceOrConstructor[]): this {
        this.loader.useModules(modules);
        return this;
    }

    useSettings(settings: IModuleSettingsCollection): this {
        this.loader.useSettings(settings);
        return this;
    }    
}