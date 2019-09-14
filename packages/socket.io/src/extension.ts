import * as http from "http";
import * as io from "socket.io";
import { IModuleHostExtension } from "@shrub/core";

declare module "@shrub/core/dist/module" {
    interface IModuleHost {
        readonly io?: io.Server;
    }
}

export interface IHttpHostExtensionOptions {
    readonly server?: http.Server;
}

export function socketIO(server: http.Server): IModuleHostExtension {
    return factory => (services, modules, settings) => {
        const host = factory(services, modules, settings);
        Object.defineProperty(host, "io", {
            value:  io(server),
            writable: false
        });
    
        return host;
    };
}