import { IModule, IServiceRegistration } from "@shrub/core";
import { MessagingModule } from "@shrub/messaging";
import { EventPublisher, IEventPublisher } from "./publisher";

export class MessagingEventsModule implements IModule {
    readonly name = "messaging-events";
    readonly dependencies = [MessagingModule];

    configureServices(registration: IServiceRegistration): void {
        registration.register(IEventPublisher, EventPublisher);
    }
}