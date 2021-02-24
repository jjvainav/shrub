import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { 
    ChannelWhitelist, IMessage, IMessageBrokerAdapter, IMessageChannelConsumer, IMessageChannelProducer, IMessagingConfiguration,
    IMessageConsumer, isChannelNameMatch, ISubscription, ISubscribeOptions, MessageHandler, MessagingModule 
} from "@shrub/messaging";
import { EventEmitter } from "@sprig/event-emitter";
import createId from "@sprig/unique-id";

export const IMessagingLocalConfiguration = createConfig<IMessagingLocalConfiguration>();
export interface IMessagingLocalConfiguration {
    /** Enables the use of local messaging. */
    useLocalMessaging(options?: IMessagingLocalOptions): void;
}

/** Defines options for local messaging. */
export interface IMessagingLocalOptions {
    /** A set of channel name patterns defining the channels the producer will send messages to; if not defined, local messaging will support all channels. */
    readonly channelNamePatterns?: string[];
}

interface IConsumerSubscription {
    readonly subscriptionId: string;
    readonly channelNamePattern: string;
    readonly handler: MessageHandler;
}

interface IMessageEvent {
    readonly channelName: string;
    readonly message: IMessage;
}

/** A module that enables messaging using local event emitters that is useful when wanting to use the pub/sub messaging in the same process. */
export class MessagingLocalModule implements IModule {
    private readonly broker = new EventEmitterBrokerAdapter();

    readonly name = "messaging-local";
    readonly dependencies = [MessagingModule];

    initialize(init: IModuleInitializer): void {
        init.config(IMessagingLocalConfiguration).register(() => ({
            useLocalMessaging: options => this.broker.addChannelNamePatterns(options && options.channelNamePatterns || ["*"])
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IMessagingConfiguration).useMessageBroker(this.broker);
    }
}

class EventEmitterBrokerAdapter implements IMessageBrokerAdapter {
    private readonly producer: EventEmitter<IMessageEvent>;
    private readonly consumer: Consumer;
    private readonly whitelist: ChannelWhitelist;

    constructor() {
        this.producer = new EventEmitter<IMessageEvent>("messaging-local-producer");
        this.consumer = new Consumer(this.producer);
        this.whitelist = new ChannelWhitelist();
    }

    addChannelNamePatterns(patterns: string[]): void {
        patterns.forEach(pattern => this.whitelist.add(pattern));
    }

    getChannelConsumer(channelNamePattern: string): IMessageChannelConsumer | undefined {
        return this.whitelist.isChannelSupported(channelNamePattern)
            ? { subscribe: options => this.consumer.subscribe(channelNamePattern, options) }
            : undefined;
    }

    getChannelProducer(channelName: string): IMessageChannelProducer | undefined {
        return {
            send: details => this.producer.emit({
                channelName,
                message: {
                    id: createId(),
                    metadata: details.metadata || {},
                    data: details.data
                }
            })
        };
    }
}

export class Consumer implements IMessageConsumer {
    private readonly subscriptions = new Map<string, IConsumerSubscription[]>();

    constructor(producer: EventEmitter<IMessageEvent>) {
        producer.event(evt => this.handleMessage(evt));
    }

    subscribe(channelNamePattern: string, options: ISubscribeOptions): Promise<ISubscription> {
        const subscription: IConsumerSubscription = {
            channelNamePattern,
            subscriptionId: options.subscriptionId,
            handler: options.handler
        };

        let subscriptionGroup = this.subscriptions.get(subscription.subscriptionId);
        if (!subscriptionGroup) {
            subscriptionGroup = [subscription];
            this.subscriptions.set(subscription.subscriptionId, subscriptionGroup);
        }

        return Promise.resolve({
            unsubscribe: () => {
                const subscriptionGroup = this.subscriptions.get(subscription.subscriptionId);
                if (subscriptionGroup) {
                    const index = subscriptionGroup.indexOf(subscription);
                    if (index > -1) {
                        subscriptionGroup.splice(index, 1);
                    }

                    if (!subscriptionGroup.length) {
                        this.subscriptions.delete(subscription.subscriptionId);
                    }
                }
            }
        });
    }

    private async handleMessage(evt: IMessageEvent): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const list of this.subscriptions.values()) {
            const matches = list.filter(subscription => isChannelNameMatch(subscription.channelNamePattern, evt.channelName));
            const match = matches.length === 1
                ? matches[0]
                : matches.length > 1
                    // grab a random handler for the subscription
                    ? matches[Math.floor(Math.random() * matches.length)]
                    : undefined;

            if (match) {
                promises.push(Promise.resolve(match.handler(evt.message)));
            }
        }

        await Promise.all(promises);
    }
}