import { createService, ServiceMap, SingletonServiceFactory, Transient } from "@shrub/core";
import { IMessage } from "../src/message";
import { 
    IMessageBrokerAdapter, IMessageBrokerService, IMessageChannelConsumer, IMessageChannelProducer, IMessageConsumer, 
    IMessageProducer, IMessageService, ISubscribeOptions, ISubscription, MessageHandler, MessageService 
} from "../src/service";
import { isChannelNameMatch } from "../src/whitelist";

describe("message service", () => {
    test("send message to consumer from producer over specific channel", async () => {
        const service = new MessageService();

        service.registerBroker(new TestBroker());

        const consumer = service.getConsumer();
        const producer = service.getProducer();

        let message: IMessage | undefined;
        let channel: string | undefined;
        await consumer.subscribe("foo", { 
            subscriptionId: "123", 
            handler: (m, c) => { 
                message = m;
                channel = c;
            } 
        });
        producer.send("foo", { 
            data: { foo: "bar" } 
        });

         expect(message).toBeDefined();
         expect(message!.data.foo).toBe("bar");
         expect(channel).toBe("foo");
    });

    test("send message to consumer from producer using channel pattern", async () => {
        const service = new MessageService();

        service.registerBroker(new TestBroker());

        const consumer = service.getConsumer();
        const producer = service.getProducer();

        let message: IMessage | undefined;
        let channel: string | undefined;
        await consumer.subscribe("*", { 
            subscriptionId: "123", 
            handler: (m, c) => { 
                message = m;
                channel = c;
            } 
        });
        producer.send("foo", { 
            data: { foo: "bar" } 
        });

         expect(message).toBeDefined();
         expect(message!.data.foo).toBe("bar");
         expect(channel).toBe("foo");
    });

    test("send message to consumer from multiple producers", async () => {
        const service = new MessageService();
        const broker1 = new TestBroker();
        const broker2 = new TestBroker();

        // register 2 different brokers that handle all channels
        service.registerBroker(broker1);
        service.registerBroker(broker2);

        const consumer = service.getConsumer();
        const producer = service.getProducer();

        const messages: IMessage[] = [];
        await consumer.subscribe("foo", { subscriptionId: "123", handler: m => { messages.push(m) } });
        producer.send("foo", { 
            data: { foo: "bar" } 
        });

        // each broker should send a message to the consumer
         expect(messages).toHaveLength(2);
    });

    test("inject consumer and producer", () => {
        const services = new ServiceMap();

        const factory = new SingletonServiceFactory(MessageService);
        services.registerSingleton(IMessageService, factory);
        services.registerSingleton(IMessageBrokerService, factory);
        services.register(ITestService, TestService);

        services.get(IMessageBrokerService).registerBroker(new TestBroker());

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
            send: details => {
                const id = this.nextId.toString();
                this.nextId++;

                const message: IMessage = {
                    id,
                    metadata: details.metadata || {},
                    data: details.data
                };

                for (const item of this.consumers) {
                    if (isChannelNameMatch(item[0], channelName)) {
                        item[1].send(message, channelName);
                    }
                }
                
                return Promise.resolve();
            }
        };
    }
}

class TestConsumer implements IMessageChannelConsumer {
    private readonly handlers: MessageHandler[] = [];

    send(message: IMessage, channel: string): void {
        this.handlers.forEach(handler => handler(message, channel));
    }

    subscribe(options: ISubscribeOptions): Promise<ISubscription> {
        this.handlers.push(options.handler);
        return Promise.resolve({
            unsubscribe: () => Promise.resolve()
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