import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { 
    IJob, IJobActiveEventArgs, IJobCompletedEventArgs, IJobFailedEventArgs, IJobOptions, IJobProgressEventArgs, IQueue, 
    IQueueConfiguration, QueueAdapter, QueueModule, WorkerCallback
} from "@shrub/queue";
import { AsyncQueue } from "@sprig/async-queue";
import { EventEmitter } from "@sprig/event-emitter";
import createId from "@sprig/unique-id";
import { parseExpression } from "cron-parser";

type Mutable<T> = { -readonly[P in keyof T]: T[P] };

export const IQueueLocalConfiguration = createConfig<IQueueLocalConfiguration>();
export interface IQueueLocalConfiguration {
    /** Enables the use of the local job queue. */
    useQueue(options?: IQueueLocalOptions): void;
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
            useQueue: options => this.adapter.addQueueNamePatterns(options && options.queueNamePatterns || ["*"])
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
            const jobActive = new EventEmitter<IJobActiveEventArgs>();
            const jobCompleted = new EventEmitter<IJobCompletedEventArgs>();
            const jobFailed = new EventEmitter<IJobFailedEventArgs>();
            const jobProgress = new EventEmitter<IJobProgressEventArgs>();
            const asyncQueue = new AsyncQueue();
            const callbacks: WorkerCallback[] = [];
            let index = 0;

            const getCallback = () => {
                // round robin
                index = callbacks.length >= index ? 0 : index;
                return callbacks.length ? callbacks[index++] : undefined;
            };

            const pushJob = (job: IJob, onFinished: () => void) => asyncQueue.push(async () => {
                // TODO: how to handle if there are no handlers for the queue?
                const callback = getCallback();
                if (callback) {
                    jobActive.emit({ job });
                    await callback(job)
                        .then(returnValue => jobCompleted.emit({ job, returnValue }))
                        .catch(error => jobFailed.emit({ job, error }))
                        .finally(() => onFinished());
                }
            });

            queue = {
                get onJobActive() {
                    return jobActive.event;
                },
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
                    let finished: () => void; 
                    const waitUntilFinished = new Promise<void>(resolve => finished = resolve);
                    const job: IJob = {
                        id: createId(),
                        name: options.name || "",
                        data: options.data || {},
                        progress: 0,
                        updateProgress(progress: number | object) {
                            (<Mutable<IJob>>this).progress = progress;
                            jobProgress.emit({ job, progress });
                            return Promise.resolve();
                        },
                        waitUntilFinished: () => waitUntilFinished
                    };

                    const getDelay = (options: IJobOptions) => {
                        if (options.delay) {
                            return options.delay;
                        }

                        if (options.repeat && options.repeat.cron) {
                            // if we want to execute immediately simply skip returning a delay
                            if (!options.repeat.immediate) {
                                const now = Date.now();
                                const next = parseExpression(options.repeat.cron).next().getTime();
                                return next - now;
                            }
                        }

                        return undefined;
                    };

                    const onFinished = () => {
                        finished();
                        if (options.repeat && options.repeat.cron) {
                            queue!.add({
                                name: options.name,
                                data: options.data,
                                delay: getDelay({ repeat: { cron: options.repeat.cron } }),
                                // make sure immediate is not set
                                repeat: { cron: options.repeat.cron }
                            });
                        }
                    };

                    const delay = getDelay(options);
                    if (delay !== undefined) {
                        setTimeout(() => pushJob(job, onFinished), delay);
                    }
                    else {
                        pushJob(job, onFinished);
                    }

                    return Promise.resolve(job);
                },
                close: () => {
                    this.queues.delete(name);
                    return new Promise(resolve => {
                        if (asyncQueue.isIdle) {
                            callbacks.length = 0;
                            resolve();
                        }
                        else {
                            asyncQueue.onIdle.once(() => {
                                callbacks.length = 0;
                                resolve();
                            });
                        }
                    });
                },
                // TODO: need to support concurrent job processing
                createWorker: optionsOrCallback => {
                    const options = this.getWorkerOptions(optionsOrCallback);
                    const callback = options.callback;
                    callbacks.push(callback);
                    return {
                        close: () => {
                            for (let i = 0; i < callbacks.length; i++) {
                                if (callbacks[i] === callback) {
                                    callbacks.splice(i, 1);
                                    break;
                                }
                            }

                            return Promise.resolve();
                        }
                    };
                }
            };

            this.queues.set(name, queue);
        }

        return queue;
    }
}