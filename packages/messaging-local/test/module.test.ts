import { IServiceCollection, ModuleLoader } from "@shrub/core";
import { IMessage, IMessageService } from "@shrub/messaging";
import { IMessagingLocalConfiguration, IMessagingLocalOptions, MessagingLocalModule } from "../src/module";

interface ITestContext {
    readonly services: IServiceCollection;
}

function setupTest(options?: IMessagingLocalOptions): Promise<ITestContext> {
    return ModuleLoader.load([{
        name: "Test Module",
        dependencies: [MessagingLocalModule],
        configure: ({ config,  }) => {
            config.get(IMessagingLocalConfiguration).useLocalMessaging(options);
        }
    }])
    .then(collection => ({ services: collection.services }));
}

describe("module", () => {
    test("verify sending and receiving message", async () => {
        const context = await setupTest();
        const messaging = context.services.get(IMessageService);

        let messageReceived: (message: IMessage) => void;
        const consumerPromise = new Promise<IMessage>(resolve => messageReceived = resolve);

        await messaging.getConsumer().subscribe("*", { 
            subscriptionId: "1",
            handler: message => messageReceived(message)
        });

        messaging.getProducer().send("foo", { data: "Hello" });

        const message = await consumerPromise;
        expect(message.data).toBe("Hello");
    });

    test("verify producer doesn't send message to subscriber of a different channel", async () => {
        const context = await setupTest();
        const messaging = context.services.get(IMessageService);

        let receivedMessage: IMessage | undefined;
        await messaging.getConsumer().subscribe("foo", { 
            subscriptionId: "1",
            handler: message => { receivedMessage = message; }
        });

        messaging.getProducer().send("bar", { data: "Hello" });
        await new Promise<void>(resolve => setTimeout(resolve, 10));

        expect(receivedMessage).toBeUndefined();
    });

    test("verify sending messages to multiple consumers with the same subscription id", async () => {
        const context = await setupTest();
        const messaging = context.services.get(IMessageService);

        let flag = false;
        let messageReceived: (message: IMessage) => void;
        const consumerPromise = new Promise<IMessage | undefined>(resolve => messageReceived = resolve);

        await messaging.getConsumer().subscribe("*", { 
            subscriptionId: "1",
            handler: message => {
                // assert that the other event was not raised
                expect(flag).toBe(false);
                messageReceived(message);
                flag = true;
            }
        });

        await messaging.getConsumer().subscribe("*", { 
            subscriptionId: "1",
            handler: message => {
                // assert that the other event was not raised
                expect(flag).toBe(false);
                messageReceived(message);
                flag = true;
            }
        });

        messaging.getProducer().send("foo", { data: "Hello" });

        await consumerPromise;
        await new Promise(resolve => setTimeout(resolve, 0));
    });
});