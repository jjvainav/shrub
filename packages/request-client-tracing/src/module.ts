import { IModule } from "@shrub/core";
import { LoggingModule } from "@shrub/logging";

export class RequestClientTracingModule implements IModule {
    readonly name = "request-client-tracing";
    readonly dependencies = [LoggingModule];
}