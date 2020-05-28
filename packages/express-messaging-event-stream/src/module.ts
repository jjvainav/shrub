import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { IMessagingConfiguration } from "@shrub/messaging";

export class ExpressMessagingEventStreamModule implements IModule {
    readonly name = "express-messaging-event-stream";

    // TODO: -- concrete producer and provides middleware
    // TODO: -- middleware should create/manage producer for the route?
    // TODO: -- need to authorize before the event-stream is opened though
}