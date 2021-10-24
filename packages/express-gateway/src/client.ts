import { createInjectable, IInjectable, IServiceCollection } from "@shrub/core";

export type ClientFactory<TClient> = (services: IServiceCollection) => TClient;

/** Defines an object responsible for communicating with an Api endpoint. */
export interface IClientType<TClient> extends IInjectable<TClient> {
}

/** Creates an injectable client. */
export function createClient<TClient>(key: string): IClientType<TClient> {
    return createInjectable({ 
        key, 
        configurable: true,
        factory: () => { throw new Error(`Client for key (${key}) not registered, client types must be registered with the express-gateway module to be used.`); }
    });
}