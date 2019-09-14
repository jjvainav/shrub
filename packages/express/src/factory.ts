import { IModuleSettingsCollection, IServiceRegistration, ModuleInstanceOrConstructor, ModuleLoader } from "@shrub/core";
import { ExpressModule, IExpressServer } from "./module";

/** A factory class for registering modules within an Express context and creating an http server. */
export class ExpressFactory {
    private readonly loader = new ModuleLoader().useModules([ExpressModule]);

    /** Creates an express http server. */
    static createServer(): Promise<IExpressServer> {
        return new ExpressFactory().createServer();
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

    /** Loads registered modules and returns an instance of the configured http server. */
    createServer(): Promise<IExpressServer> {
        return this.loader.load().then(modules => modules.services.get(IExpressServer));
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