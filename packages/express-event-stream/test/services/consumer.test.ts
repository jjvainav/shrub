import { EventStreamConsumerService, IEventStreamChannelConsumerOptions } from "../../src/services/consumer";

/** The internal consumer created by the service. */
interface IEventStreamChannelConsumer {
    readonly options: IEventStreamChannelConsumerOptions;
}

describe("consumer service", () => { 
    test("get message channel consumer for endpoint configured to handle all channels", async () => {
        const service = new EventStreamConsumerService();

        service.addConsumer({
            endpoints: [
                { 
                    channelNamePatterns: ["myChannel"],
                    url: "http://localhost:3000/bind" 
                },
                { url: "http://localhost:3000/bind2" }
            ]
        });

        const consumer: IEventStreamChannelConsumer = <any>service.getMessageChannelConsumer("channel");

        expect(consumer.options.channelNamePattern).toBe("channel");
        expect(consumer.options.url).toBe("http://localhost:3000/bind2");
    });

    test("get message channel consumer for endpoint configured to handle a channel pattern with a wildcard", async () => {
        const service = new EventStreamConsumerService();

        service.addConsumer({
            endpoints: [
                { 
                    channelNamePatterns: ["chan*"],
                    url: "http://localhost:3000/bind" 
                },
                { url: "http://localhost:3000/bind2" }
            ]
        });

        const consumer: IEventStreamChannelConsumer = <any>service.getMessageChannelConsumer("channel");

        expect(consumer.options.channelNamePattern).toBe("channel");
        expect(consumer.options.url).toBe("http://localhost:3000/bind");
    });

    test("get message channel consumer when multiple endpoints are configured to handle all channels", async () => {
        const service = new EventStreamConsumerService();

        service.addConsumer({
            endpoints: [
                { url: "http://localhost:3000/bind" },
                { url: "http://localhost:3000/bind2" }
            ]
        });

        const consumer: IEventStreamChannelConsumer = <any>service.getMessageChannelConsumer("channel");

        // if there are multiple endpoints that match a channel the first one wins
        expect(consumer.options.channelNamePattern).toBe("channel");
        expect(consumer.options.url).toBe("http://localhost:3000/bind");
    });
});