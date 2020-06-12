import { IModule, IModuleConfigurator } from "@shrub/core";
import { IErrorConverter, ILogEvent, ILoggingConfiguration, LoggingModule } from "@shrub/logging";
import { RequestError } from "@sprig/request-client";

type Mutable<T> = {-readonly[P in keyof T]: T[P]};

const requestErrorConverter: IErrorConverter = (err) => {
    if (RequestError.isRequestError(err)) {
        const data: Mutable<ILogEvent> = {
            name: "request-error",
            code: err.code,
            message: err.message,
            stack: err.stack
        };

        if (err.data) {
            if (isError(err.data)) {
                data.inner = JSON.stringify({
                    name: err.data.name,
                    message: err.data.message,
                    stack: err.data.stack
                });
            }
            else {
                data.data = JSON.stringify(err.data);
            }
        }

        if (err.response) {
            data["response.status"] = err.response.status.toString();
            if (err.response.data) {
                data["response.body"] = JSON.stringify(err.response.data);
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
        config.get(ILoggingConfiguration).useErrorConverter(requestErrorConverter);
    }
}