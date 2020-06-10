import { createService, ServiceMap, Transient } from "@shrub/core";
import { IMessage } from "../src/message";
import { 
    IMessageBrokerAdapter, IMessageChannelConsumer, IMessageChannelProducer, IMessageConsumer, 
    IMessageConsumerSubscribeOptions, IMessageProducer, IMessageService, isChannelNameMatch, 
    isChannelNamePattern, ISubscription, MessageHandler, MessageService 
} from "../src/service";

describe("message service", () => {
    test("verify channel name is a pattern", () => {
        expect(isChannelNamePattern("")).toBe(false);
        expect(isChannelNamePattern("foo")).toBe(false);
        expect(isChannelNamePattern("foo:*")).toBe(true);
        expect(isChannelNamePattern("*")).toBe(true);
    });

    test("verify channel name pattern match", () => {
        expect(isChannelNameMatch("", "foo")).toBe(false);
        expect(isChannelNameMatch("foo", "foo")).toBe(true);
        expect(isChannelNameMatch("*oo", "foo")).toBe(true);
        expect(isChannelNameMatch("f*o", "foo")).toBe(true);
        expect(isChannelNameMatch("f*oo", "foo")).toBe(true);
        expect(isChannelNameMatch("foo*", "foo")).toBe(true);
        expect(isChannelNameMatch("foo:*", "foo")).toBe(false);
        expect(isChannelNameMatch("foo:*", "foo:bar")).toBe(true);
        expect(isChannelNameMatch("foo:*:*", "foo:bar:1")).toBe(true);
        expect(isChannelNameMatch("foo:*", "foo:*:*")).toBe(true);
        expect(isChannelNameMatch("*", "foo")).toBe(true);
    });

    test("send message to consumer from producer", async () => {
        const service = new MessageService();

        service.registerBroker(new TestBroker());

        const consumer = service.getChannelConsumer("foo");
        const producer = service.getChannelProducer("foo");

        let message: IMessage | undefined;
        await consumer.subscribe({ subscriptionId: "123", handler: m => { message = m } });
        producer.send({ 
            data: { foo: "bar" } 
        });

         expect(message).toBeDefined();
         expect(message!.data.foo).toBe("bar");
    });

    test("inject consumer and producer", () => {
        const services = new ServiceMap();

        services.register(IMessageService, MessageService);
        services.register(ITestService, TestService);

        services.get(IMessageService).registerBroker(new TestBroker());

        const service = services.get(ITestService);

        expect(service.consumer).toBeDefined();
        expect(service.producer).toBeDefined();
    });
});

class TestBroker implements IMessageBrokerAdapter {
    private readonly consumers: [string, TestConsumer][] = [];
    private nextId = 1;

    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined {
        const consumer = new TestConsumer();
        this.consumers.push([channelNamePattern, consumer]);
        return consumer;
    }

    getChannelProducer(channelName: string): IMessageChannelProducer | undefined {
        return {
            send: options => {
                const id = this.nextId.toString();
                this.nextId++;

                const message: IMessage = {
                    id,
                    metadata: options.metadata || {},
                    data: options.data
                };

                for (const item of this.consumers) {
                    if (isChannelNameMatch(item[0], channelName)) {
                        item[1].send(message);
                    }
                }      
            }
        };
    }
}

class TestConsumer implements IMessageChannelConsumer {
    private readonly handlers: MessageHandler[] = [];

    send(message: IMessage): void {
        this.handlers.forEach(handler => handler(message));
    }

    subscribe(options: IMessageConsumerSubscribeOptions): Promise<ISubscription> {
        this.handlers.push(options.handler);
        return Promise.resolve({
            unsubscribe: () => {}
        });
    }
}

interface ITestService {
    readonly consumer: IMessageConsumer;
    readonly producer: IMessageProducer;
}

const ITestService = createService<ITestService>("test-service");

@Transient
class TestService implements ITestService {
    constructor(
        @IMessageConsumer readonly consumer: IMessageConsumer,
        @IMessageProducer readonly producer: IMessageProducer) {
    }
}