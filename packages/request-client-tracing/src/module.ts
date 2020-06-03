import { IModule, IModuleConfigurator } from "@shrub/core";
import { IErrorLogData, ILogDataConverter, ITracingConfiguration, TracingModule } from "@shrub/tracing";
import { RequestError } from "@sprig/request-client";

const requestErrorConverter: ILogDataConverter = (obj, context) => {
    const err = <any>obj;
    if (RequestError.isRequestError(err)) {
        const props: { [key: string]: string } = { code: err.code };
        const data: IErrorLogData = {
            type: "error",
            name: "RequestError",
            props,
            message: err.message,
            stack: err.stack
        };

        if (err.data) {
            for (const key of Object.keys(data)) {
                if (err.data[key] != undefined) {
                    props["data." + key] = context.toString(err.data[key]);
                }
            }
        }

        if (err.response) {
            props["response.status"] = err.response.status.toString();
            if (err.response.data) {
                props["response.body"] = context.toString(err.response.data);
            }

        }
        
        return data;
    }

    return undefined;
};

/** Module that injects a tracing log data converter for request client errors; this is useful when a module uses the request-client to make API calls. */
export class RequestClientTracingModule implements IModule {
    readonly name = "request-client-tracing";
    readonly dependencies = [TracingModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(ITracingConfiguration).useLogDataConverter(requestErrorConverter);
    }
}