import { NextFunction, Request, Response } from "express";
import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ExpressModule, IExpressConfiguration } from "@shrub/express";
import { ExpressSessionModule } from "@shrub/express-session";
import { IAuthenticationHandler, IAuthenticationObserver } from "./authentication";
import { identityMiddleware, IIdentityOptions } from "./identity";
import { ITokenOptions, tokenMiddleware } from "./token";

export const IExpressIdentityConfiguration = createConfig<IExpressIdentityConfiguration>();
export interface IExpressIdentityConfiguration {
    useAuthentication(handler: IAuthenticationHandler): void;
    useAuthenticationObserver(observer: IAuthenticationObserver): void;
    useTokenOptions(options: ITokenOptions): void;
}

/** 
 * Express module that installs identity and token middleware. Note, the package also supports authorization 
 * but this is not installed by default and needs to be added via the authorization middleware; this allows
 * better control over the endpoints that require and do not require authorization.
 */
export class ExpressIdentityModule implements IModule {
    private options: IIdentityOptions = { authenticationHandlers: [] };
    private tokenOptions?: ITokenOptions;

    readonly name = "express-identity";
    readonly dependencies = [
        ExpressModule,
        ExpressSessionModule
    ];

    initialize({ config }: IModuleInitializer): void {
        config(IExpressIdentityConfiguration).register(() => ({
            useAuthentication: handler => {
                for (const h of this.options.authenticationHandlers) {
                    if (h.scheme === handler.scheme) {
                        // ignore the handler if one is already registered with the same scheme
                        // this is useful for scenarios where multiple modules try to register the same handler
                        return;
                    }
                }

                this.options.authenticationHandlers.push(handler);
            },
            useAuthenticationObserver: observer => {
                const authenticationObservers = this.options.authenticationObservers || [];
                authenticationObservers.push(observer);
                this.options = { ...this.options, authenticationObservers };
            },
            useTokenOptions: options => {
                if (this.tokenOptions) {
                    throw new Error("Token options have already been set.");
                }

                this.tokenOptions = options
            }
        })); 
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IExpressConfiguration).use((req: Request, res: Response, next: NextFunction) => {
            return tokenMiddleware(this.tokenOptions || {})(req, res, next);
        });

        config.get(IExpressConfiguration).use((req: Request, res: Response, next: NextFunction) => {
            return identityMiddleware(this.options)(req, res, next);
        });
    }
}