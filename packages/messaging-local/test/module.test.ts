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