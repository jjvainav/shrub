import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { IMessagingConfiguration, isChannelNameMatch } from "@shrub/messaging";
import { EventStreamChannelConsumer, IEventStreamInterceptors } from "./consumer";

export const IMessagingEventStreamConfiguration = createConfig<IMessagingEventStreamConfiguration>();
export interface IMessagingEventStreamConfiguration {
    /** Registers the use of event-stream consumers. */
    useEventStreamConsumer(options: IEventStreamConsumerOptions): void;
}

/** Defines options for event-stream consumers. */
export interface IEventStreamConsumerOptions {
    /** A set of endpoints for the consumer to connect to. */
    readonly endpoints: IEventStreamEndpoint[];
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
}

/** Represents an endpoint and channel mapping for a consumer to connect to. */
export interface IEventStreamEndpoint {
    /** A set of patterns the endpoint supports; the default is '*' to represent 'all'.  */
    readonly channelNamePatterns?: string[];
    /** A url to connect to. */
    readonly url: string;
}

function findEndpoint(endpoints: IEventStreamEndpoint[], channelNamePattern: string): IEventStreamEndpoint | undefined {
    for (const endpoint of endpoints) {
        if (!endpoint.channelNamePatterns) {
            return endpoint;
        }

        for (const pattern of endpoint.channelNamePatterns) {
            if (isChannelNameMatch(pattern, channelNamePattern)) {
                return endpoint;
            }
        }
    }

    return undefined;
}

/** 
 * Core module for using event-streams for brokerless messaging. 
 * This module only provides support for consumers but not producers.
 * Look at the express-event-stream package for producer support.
 */
export class MessagingEventStreamModule implements IModule {
    readonly name = "messaging-event-stream";

    initialize(init: IModuleInitializer): void {
        init.config(IMessagingEventStreamConfiguration).register(({ config }) => ({
            useEventStreamConsumer: options => config.get(IMessagingConfiguration).useMessageBroker({
                getChannelConsumer: channelNamePattern => {
                    const endpoint = findEndpoint(options.endpoints, channelNamePattern);
                    if (!endpoint) {
                        return undefined;
                    }

                    return new EventStreamChannelConsumer({
                        channelNamePattern,
                        url: endpoint.url,
                        interceptors: options.interceptors
                    });
                },
                getChannelProducer: () => undefined
            })
        }));
    }
}