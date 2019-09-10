import { Request } from "express";
import { createService, Singleton } from "@shrub/core";

/** 
 * A service used to capture the current request context just before instantiating a Controller. 
 * This is used by the IRequestContextService to grab an instance of the current request context.
 */
export interface IControllerRequestService {
    captureRequest(req: Request): void;
    getCurrentRequest(): Request | undefined;
}

export const IControllerRequestService = createService<IControllerRequestService>("controller-request-service");

@Singleton
export class ControllerRequestService implements IControllerRequestService {
    private req?: Request;

    captureRequest(req: Request): void {
        this.req = req;
    }

    getCurrentRequest(): Request | undefined {
        return this.req;
    }
}