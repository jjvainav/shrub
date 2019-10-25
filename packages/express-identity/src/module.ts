import { NextFunction, Request, Response } from "express";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { ExpressSessionModule } from "@shrub/express-session";
import { IAuthenticationHandler, IAuthenticationObserver } from "./authentication";
import { identity, IIdentityOptions } from "./identity";

/** Defines options for registering authentication handlers. */
export interface IAuthenticationHandlerOptions {
    /** True if the authentication handler should be the default. This is useful when registering multiple authentication handlers. */
    readonly isDefault?: boolean;
}

export const IExpressIdentityConfiguration = createConfig<IExpressIdentityConfiguration>();
export interface IExpressIdentityConfiguration {
    useAuthentication(handler: IAuthenticationHandler, options?: IAuthenticationHandlerOptions): void;
    useAuthenticationObserver(observer: IAuthenticationObserver): void;
}

export class ExpressIdentityModule implements IModule {
    private options: IIdentityOptions = { authenticationHandlers: [] };

    readonly name = "express-identity";
    readonly dependencies = [
        ExpressModule,
        ExpressSessionModule
    ];

    initialize({ config }: IModuleInitializer): void {
        config(IExpressIdentityConfiguration).register(() => ({
            useAuthentication: (handler, options) => {
                for (const h of this.options.authenticationHandlers) {
                    if (h.scheme === handler.scheme) {
                        // ignore the handler if one is already registered with the same scheme
                        return;
                    }
                }

                this.options.authenticationHandlers.push(handler);

                if (options && options.isDefault) {
                    if (this.options.defaultScheme) {
                        throw new Error(`A default authentication scheme (${this.options.defaultScheme}) has already been set.`);
                    }

                    this.options = {
                        ...this.options,
                        defaultScheme: handler.scheme
                    };
                }
            },
            useAuthenticationObserver: observer => {
                const authenticationObservers = this.options.authenticationObservers || [];
                authenticationObservers.push(observer);
                this.options = { ...this.options, authenticationObservers };
            }
        }));        
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req: Request, res: Response, next: NextFunction) => {
            return identity(this.options)(req, res, next);
        });
    }
}