import { IModuleSettingsCollection, IServiceRegistration, ModuleInstanceOrConstructor, ModuleLoader } from "@shrub/core";
import { ExpressModule, IExpressApplication } from "./module";

/** A factory class for registering modules within an Express application context. */
export class ExpressFactory {
    private readonly modules: ModuleInstanceOrConstructor[] = [ExpressModule];
    private readonly settings: IModuleSettingsCollection[] = [];
    private configureCallback: (registration: IServiceRegistration) => void = () => {};


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

    /** Creates a new loader instance and loads registered modules; returns an instance of the configured express application. */
    create(): Promise<IExpressApplication> {
        const loader = new ModuleLoader()
            .configureServices(this.configureCallback)
            .useModules(this.modules);

        this.settings.forEach(cur => loader.useSettings(cur));
        return loader.load().then(modules => modules.services.get(IExpressApplication));
    }

    configureServices(callback: (registration: IServiceRegistration) => void): this {
        const base = this.configureCallback;
        this.configureCallback = registration => {
            callback(registration);
            base(registration);
        };
        
        return this;
    }

    useModules(modules: ModuleInstanceOrConstructor[]): this {
        this.modules.push(...modules);
        return this;
    }

    useSettings(settings: IModuleSettingsCollection): this {
        this.settings.push(settings);
        return this;
    }    
}