import * as express from "express";
import { combineExtensions, createHostBuilder, IModuleHost, IModuleHostExtension, IModuleHostBuilder } from "@shrub/core";

export interface IExpressHost extends IModuleHost {
    readonly app: express.Express;
}

export interface IExpressHostBuilder extends IModuleHostBuilder<IExpressHost> {
}

export interface IExpressHostBuilderOptions {
    readonly app?: express.Express;
    readonly extension?: IModuleHostExtension;
}

/** Creates a host builder for modules hosted by an express app. */
export function createExpressHostBuilder(options?: IExpressHostBuilderOptions): IExpressHostBuilder {
    let extension: IModuleHostExtension = factory => (services, modules, settings) => {
        const host = factory(services, modules, settings);
        Object.defineProperty(host, "app", {
            value:  (options && options.app) || express(),
            writable: false
        });
    
        return <IExpressHost>host;
    };

    if (options && options.extension) {
        extension = combineExtensions(extension, options.extension);
    }

    return <IExpressHostBuilder>createHostBuilder(extension);
}