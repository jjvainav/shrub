import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { 
    IJob, IJobCompletedEventArgs, IJobFailedEventArgs, IJobProgressEventArgs, IQueue, 
    IQueueConfiguration, ProcessJobCallback, QueueAdapter, QueueModule 
} from "@shrub/queue";
import { AsyncQueue } from "@sprig/async-queue";
import { EventEmitter } from "@sprig/event-emitter";
import createId from "@sprig/unique-id";

type Mutable<T> = { -readonly[P in keyof T]: T[P] };

export const IQueueLocalConfiguration = createConfig<IQueueLocalConfiguration>();
export interface IQueueLocalConfiguration {
    /** Enables the use of the local job queue. */
    useLocalQueue(options?: IQueueLocalOptions): void;
}

/** Defines options for the local job queue. */
export interface IQueueLocalOptions {
    /** A set of queue name patterns defining the queues the local adapter will handle; if not defined, local job queue will be used for all queues. */
    readonly queueNamePatterns?: string[];
}

export class QueueLocalModule implements IModule {
    private readonly adapter = new LocalQueueAdapter([]);

    readonly name = "queue-local";
    readonly dependencies = [QueueModule];

    initialize(init: IModuleInitializer): void {
        init.config(IQueueLocalConfiguration).register(() => ({
            useLocalQueue: options => this.adapter.addQueueNamePatterns(options && options.queueNamePatterns || ["*"])
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IQueueConfiguration).useQueue(this.adapter);
    }
}

class LocalQueueAdapter extends QueueAdapter {
    private readonly queues = new Map<string, IQueue>();

    protected getQueueInstance(name: string): IQueue {
        let queue = this.queues.get(name);

        if (!queue) {
            const jobCompleted = new EventEmitter<IJobCompletedEventArgs>();
            const jobFailed = new EventEmitter<IJobFailedEventArgs>();
            const jobProgress = new EventEmitter<IJobProgressEventArgs>();
            const asyncQueue = new AsyncQueue();
            const callbacks: ProcessJobCallback[] = [];
            let index = 0;

            const getCallback = () => {
                // round robin
                index = callbacks.length >= index ? 0 : index;
                return callbacks.length ? callbacks[index++] : undefined;
            };

            queue = {
                get onJobCompleted() {
                    return jobCompleted.event;
                },
                get onJobFailed() {
                    return jobFailed.event;
                },
                get onJobProgress() {
                    return jobProgress.event;
                },
                add: options => {
                    const job: IJob = {
                        id: createId(),
                        data: options.data || {},
                        progress: 0,
                        updateProgress(progress: number | object) {
                            (<Mutable<IJob>>this).progress = progress;
                            jobProgress.emit({ job, progress });
                            return Promise.resolve();
                        }
                    };

                    asyncQueue.push(async () => {
                        // TODO: how to handle if there are no handlers for the queue?
                        const callback = getCallback();
                        if (callback) {
                            await callback(job)
                                .then(returnValue => jobCompleted.emit({ job, returnValue }))
                                .catch(error => jobFailed.emit({ job, error }));
                        }
                    });

                    return Promise.resolve(job);
                },
                // TODO: need to support concurrent job processing
                process: options => {
                    callbacks.push(options.callback);
                    return {
                        close: () => {
                            this.queues.delete(name);
                            return new Promise(resolve => {
                                if (asyncQueue.isIdle) {
                                    resolve();
                                }
                                else {
                                    asyncQueue.onIdle.once(() => resolve());
                                }
                            });
                        }
                    };
                }
            };

            this.queues.set(name, queue);
        }

        return queue;
    }
}