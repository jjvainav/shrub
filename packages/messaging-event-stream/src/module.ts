import { createConfig, IModule, IModuleInitializer } from "@shrub/core";
import { IMessagingConfiguration } from "@shrub/messaging";
import urlJoin from "url-join";
import { EventStreamChannelConsumer, IEventStreamInterceptors } from "./consumer";

export const IMessagingEventStreamConfiguration = createConfig<IMessagingEventStreamConfiguration>();
export interface IMessagingEventStreamConfiguration {
    /** Registers the use of event-stream consumers. */
    useEventStreamConsumer(options: IEventStreamConsumerOptions): void;
}

/** Converts a channel name into a url. */
export interface IChannelNameUrlConverter {
    (channelName: string): string;
}

/** Defines options for event-stream consumers. */
export interface IEventStreamConsumerOptions {
    /** A set of channel names and patterns expected by the consumer. */
    readonly channels: string[];
    /** A callback for converting a channel name into a url. */
    readonly channelNameConverter: IChannelNameUrlConverter;
    /** Optional interceptors that get passed to the underlying RequestEventStream. */
    readonly interceptors?: IEventStreamInterceptors;
}

/** 
 * Default channel converter that builds a url from a channel name. An optional delimiter is used to identify url parts; for example, 
 * the default delimiter is a colon (:) so a channel name of foo:bar:1 will be converted to baseUrl/foo/bar/1.
 */
export const channelConverter: (baseUrl: string, delimiter?: string) => IChannelNameUrlConverter = (baseUrl, delimiter) => channelName => {
    delimiter = delimiter !== undefined ? delimiter : ":";
    return urlJoin(baseUrl, channelName.replace(delimiter, "/"));
};

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
                getChannelConsumer: channelName => new EventStreamChannelConsumer({
                    url: options.channelNameConverter(channelName),
                    interceptors: options.interceptors
                }),
                getChannelProducer: () => undefined
            }, {
                channelNames: options.channels
            })
        }));
    }
}