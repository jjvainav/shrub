import { IModule, IModuleConfigurator } from "@shrub/core";
import { ILogDataConverter, ILogEvent, ILoggingConfiguration, LoggingModule } from "@shrub/logging";
import { RequestError } from "@sprig/request-client";

type Mutable<T> = {-readonly[P in keyof T]: T[P]};

const requestErrorConverter: ILogDataConverter = (arg) => {
    if (isError(arg) && RequestError.isRequestError(arg)) {
        const data: Mutable<ILogEvent> = {
            name: "request-error",
            code: arg.code,
            message: arg.message,
            stack: arg.stack
        };

        if (arg.data) {
            if (isError(arg.data)) {
                data.inner = JSON.stringify({
                    name: arg.data.name,
                    message: arg.data.message,
                    stack: arg.data.stack
                });
            }
            else {
                data.data = JSON.stringify(arg.data);
            }
        }

        if (arg.response) {
            data["response.status"] = arg.response.status.toString();
            if (arg.response.data) {
                data["response.body"] = JSON.stringify(arg.response.data);
            }
        }
        
        return data;
    }

    return undefined;
};

function isError(obj: any): obj is Error {
    // instanceof only works if sub-classes extend Error properly (prototype gets set to Error);
    // if the instanceof check fails assume an Error if name, message, and stack are defined.
    return obj instanceof Error || (
        (<Error>obj).name !== undefined &&
        (<Error>obj).message !== undefined &&
        (<Error>obj).stack !== undefined);
}

/** Module that injects an error converter for request client errors; this is useful when a module uses the request-client to make API calls. */
export class RequestClientLoggingModule implements IModule {
    readonly name = "request-client-logging";
    readonly dependencies = [LoggingModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(ILoggingConfiguration).useConverter(requestErrorConverter);
    }
}