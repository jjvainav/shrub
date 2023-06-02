import { ModuleLoader } from "@shrub/core";
import { IQueueService } from "@shrub/queue";
import { IQueueBullMQConfiguration, IQueueBullMQOptions, QueueBullMQModule } from "../src/module";

export interface ITestContext {
    readonly done: () => Promise<void>;
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
                enableEvents: true,
                queueNamePatterns: options && options.queueNamePatterns
            });
        }
    }])
    .then(collection => ({ 
        done: () => collection.dispose(),
        queueService: collection.services.get(IQueueService) 
    }));
}