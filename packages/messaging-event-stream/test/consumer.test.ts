// in order for the mock to work it must be imported first
import { mockClear, mockResponse } from "@sprig/request-client-mock";
import { IMessage } from "@shrub/messaging";
import { EventStreamChannelConsumer } from "../src/consumer";

describe("event-stream channel consumer", () => {
    beforeEach(() => {
        mockClear();
    });

    test("subscribe to consumer and handle message", done => {
        mockResponse({ 
            status: 200,
            data: { 
                id: "123",
                headers: { eventType: "created" },
                body: { foo: "bar" }
            }
        });

        const consumer = new EventStreamChannelConsumer({
            channelNamePattern: "*",
            url: "http://localhost"
        });

        consumer.subscribe("abc", message => {
            expect(message.id).toBe("123");
            expect(message.headers.eventType).toBe("created");
            expect(message.body.foo).toBe("bar");
            done();
        });
    });

    test("subscribe to consumer and handle multiple messages asynchronously", async done => {
        const context = mockResponse({ 
            status: 200,
            data: { 
                id: "123",
                headers: { eventType: "created" },
                body: { foo: "bar" }
            }
        });

        const consumer = new EventStreamChannelConsumer({
            channelNamePattern: "*",
            url: "http://localhost"
        });

        const messages: IMessage[] = [];
        await consumer.subscribe("abc", message => new Promise(resolve => setTimeout(() => {
            messages.push(message);
            resolve();

            if (messages.length === 3) {
                expect(messages[0].id).toBe("123");
                expect(messages[1].id).toBe("124");
                expect(messages[2].id).toBe("125");
                done();
            }
        },
        10)));

        context.sendEventSourceMessage({ 
            id: "124",
            headers: { eventType: "created" },
            body: { foo: "bar" }
        });
        context.sendEventSourceMessage({ 
            id: "125",
            headers: { eventType: "created" },
            body: { foo: "bar" }
        });
    });

    test("unsubscribe from consumer", async done => {
        const context = mockResponse({ 
            status: 200,
            data: { 
                id: "123",
                headers: { eventType: "created" },
                body: { foo: "bar" }
            }
        });

        const consumer = new EventStreamChannelConsumer({
            channelNamePattern: "*",
            url: "http://localhost"
        });

        const messages: IMessage[] = [];
        const subscription = await consumer.subscribe("abc", message => { messages.push(message) });

        setTimeout(() => {
            subscription.unsubscribe();
            context.sendEventSourceMessage({ 
                id: "124",
                headers: { eventType: "created" },
                body: { foo: "bar" }
            });

            setTimeout(() => {
                expect(messages.length).toBe(1);
                done();    
            });
        });
    });
});