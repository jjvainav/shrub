import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogger, LoggingModule } from "@shrub/logging";
import { IJob, IJobCompletedEventArgs, IJobFailedEventArgs, IJobProgressEventArgs, IQueue, IQueueConfiguration, QueueAdapter, QueueModule } from "@shrub/queue";
import { EventEmitter } from "@sprig/event-emitter";
import { ConnectionOptions, Job, Queue, Worker, WorkerListener } from "bullmq";

export interface IQueueBullMQConfiguration {
    /** Enables the use of the a BullMQ job queue. */
    useBullMQQueue(options?: IQueueBullMQOptions): void;
}

/** Defines options for the BullMQ job queue. */
export interface IQueueBullMQOptions {
    /** BullMQ connection options for connecting to Redis. */
    readonly connection?: ConnectionOptions;
    /** A set of queue name patterns defining the queues the BullMQ adapter will handle; if not defined, BullMQ job queue will be used for all queues. */
    readonly queueNamePatterns?: string[];
}

interface IQueueEventEmitter {
    readonly count: number;
    hookWorker(worker: Worker): void;
    unhookWorker(worker: Worker): void;
}

function convertJob(job: Job): IJob {
    return {
        id: job.id || "",
        data: job.data,
        get progress() {
            return job.progress;
        },
        updateProgress(progress) {
            return job.updateProgress(progress);
        }
    };
}

export const IQueueBullMQConfiguration = createConfig<IQueueBullMQConfiguration>();
let nextWorkerId = 1;

export class QueueBullMQModule implements IModule {
    private readonly adapters: BullMQQueueAdapter[] = [];

    readonly name = "queue-bullmq";
    readonly dependencies = [
        LoggingModule,
        QueueModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IQueueBullMQConfiguration).register(({ services }) => ({
            useBullMQQueue: options => this.adapters.push(new BullMQQueueAdapter(
                services.get(ILogger),
                options && options.connection, 
                options && options.queueNamePatterns))
        }));
    }

    async configure({ config, next }: IModuleConfigurator): Promise<void> {
        await next();
        const queue = config.get(IQueueConfiguration);
        this.adapters.forEach(adapter => queue.useQueue(adapter));
    }
}

class BullMQQueueAdapter extends QueueAdapter {
    constructor(
        private readonly logger: ILogger,
        private readonly connection?: ConnectionOptions,
        queueNamePatterns?: string[]) {
            super(queueNamePatterns || ["*"]);
    }

    protected getQueueInstance(name: string): IQueue {
        const workerEvents = new BullMQWorkerEvents(this.logger);
        return {
            get onJobCompleted() {
                return workerEvents.jobCompleted.event;
            },
            get onJobFailed() {
                return workerEvents.jobFailed.event;
            },
            get onJobProgress() {
                return workerEvents.jobProgress.event;
            },
            add: options => new Queue(name, { connection: this.connection })
                .add(options.name || "", options.data || {})
                .then(job => convertJob(job)),
            process: options => {
                const worker = new Worker(name, job => options.callback(convertJob(job)), { 
                    concurrency: options.concurrency,
                    connection: this.connection
                });

                const workerId = nextWorkerId++;
                workerEvents.registerWorker(workerId, worker);

                // BullMQ recommends attaching to 'error' and since we don't get job info pass the error to the logger
                // https://docs.bullmq.io/guide/workers
                worker.on("error", error => this.logger.logError(error));

                return {
                    close: () => {
                        workerEvents.unregisterWorker(workerId);
                        return worker.close();
                    }
                };
            }
        };
    }
}

class BullMQWorkerEvents {
    private readonly emitters: IQueueEventEmitter[] = [];
    private readonly workers = new Map<number, Worker>();

    readonly jobCompleted = this.createEventEmitter<IJobCompletedEventArgs, "completed">("completed", (job, returnValue) => {
        this.logger.logDebug({ name: "BullMQ - job completed", job: job.id });
        this.jobCompleted.emit({ job: convertJob(job), returnValue });
    });

    readonly jobFailed = this.createEventEmitter<IJobFailedEventArgs, "failed">("failed", (job, error) => {
        this.logger.logWarn({ name: "BullMQ - job failed", job: job.id, message: error.message, stack: error.stack });
        this.jobFailed.emit({ job: convertJob(job), error });
    });

    readonly jobProgress = this.createEventEmitter<IJobProgressEventArgs, "progress">("progress", (job, progress) => {
        this.logger.logDebug({ name: "BullMQ - job progress", job: job.id, progress: typeof progress === "number" ? progress : JSON.stringify(progress) });
        this.jobProgress.emit({ job: convertJob(job), progress });
    });

    constructor(private readonly logger: ILogger) {
    }

    registerWorker(id: number, worker: Worker): void {
        this.workers.set(id, worker);
        for (const emitter of this.emitters) {
            if (emitter.count) {
                emitter.hookWorker(worker);
            }
        }
    }

    unregisterWorker(id: number): void {
        const worker = this.workers.get(id);
        if (worker) {
            this.emitters.forEach(emitter => emitter.unhookWorker(worker));
            this.workers.delete(id);
        }
    }

    private createEventEmitter<TArgs, T extends keyof WorkerListener>(event: T, listener: WorkerListener[T]): EventEmitter<TArgs> & IQueueEventEmitter {
        const self = this;
        return new class extends EventEmitter<TArgs> implements IQueueEventEmitter {
            constructor() {
                super();
                self.emitters.push(this);
            }

            get count(): number {
                return super.count;
            }

            hookWorker(worker: Worker): void {
                worker.on(event, listener);
            }

            unhookWorker(worker: Worker): void {
                worker.removeListener(event, listener);
            }

            protected callbackRegistered(): void {
                if (this.count === 1) {
                    for (const worker of self.workers.values()) {
                        this.hookWorker(worker);
                    }
                }
            }
        
            protected callbackUnregistered(): void {
                if (this.count === 0) {
                    for (const worker of self.workers.values()) {
                        this.unhookWorker(worker);
                    }
                }
            }
        };
    }
}