import { ModuleLoader } from "@shrub/core";
import { IQueueService } from "@shrub/queue";
import { IQueueBullMQConfiguration, IQueueBullMQOptions, QueueBullMQModule } from "../src/module";

interface ITestContext {
    readonly queueService: IQueueService;
}

export function setup(options?: Partial<IQueueBullMQOptions>): Promise<ITestContext> {
    return ModuleLoader.load([{
        name: "Test Module",
        dependencies: [QueueBullMQModule],
        configure: ({ config }) => {
            config.get(IQueueBullMQConfiguration).useQueue({                
                connection: options && options.connection || {
                    host: "localhost",
                    port: 6379
                },
                queueNamePatterns: options && options.queueNamePatterns,
                queueSchedulers: options && options.queueSchedulers
            });
        }
    }])
    .then(collection => ({ queueService: collection.services.get(IQueueService) }));
}