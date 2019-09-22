import { IModule, IModuleConfigurator } from "@shrub/core";
import { ISerializer, ITracingConfiguration, TracingModule } from "@shrub/tracing";
import { RequestError } from "@sprig/request-client";

const requestErrorSerializer: ISerializer = (obj, data, serialize) => {
    if (obj instanceof RequestError) {
        data = { 
            ...data, 
            code: obj.code,
            inner: obj.data && serialize(obj.data),
        };

        if (obj.response && obj.response.data) {
            data = {
                ...data,
                response: {
                    status: obj.response.status,
                    body: serialize(obj.response.data)
                }
            };
        }            
    }

    return data;
};

/** Module that injects a tracing serializer for request client errors; this is useful when a module uses the request-client to make API calls. */
export class RequestClientTracingModule implements IModule {
    readonly name = "request-client-tracing";
    readonly dependencies = [TracingModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(ITracingConfiguration).useSerializer(requestErrorSerializer);
    }
}