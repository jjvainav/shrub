import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogger, LoggingModule } from "@shrub/logging";
import { IJob, IJobActiveEventArgs, IJobCompletedEventArgs, IJobFailedEventArgs, IJobProgressEventArgs, 
    IQueue, IQueueConfiguration, QueueAdapter, QueueModule 
} from "@shrub/queue";
import { EventEmitter } from "@sprig/event-emitter";
import { ConnectionOptions, Job, JobsOptions, Queue, QueueScheduler, Worker } from "bullmq";

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
    /** A set of queue names that are expected to process delayed or preating jobs. By default, BullMQ will not process these jobs unless explicitely defined. See https://docs.bullmq.io/guide/queuescheduler  */
    readonly queueSchedulers?: string[];
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
                options && options.queueNamePatterns,
                options && options.queueSchedulers))
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
        queueNamePatterns?: string[],
        queueSchedulers?: string[]) {
            super(queueNamePatterns || ["*"]);
            this.initializeSchedulers(queueSchedulers || []);       
    }

    protected getQueueInstance(name: string): IQueue {
        const jobActive = new QueueEventEmitter<IJobActiveEventArgs>();
        const jobCompleted = new QueueEventEmitter<IJobCompletedEventArgs>();
        const jobFailed = new QueueEventEmitter<IJobFailedEventArgs>();
        const jobProgress = new QueueEventEmitter<IJobProgressEventArgs>();
        let instance: Queue;

        return {
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
                const jobOptions: JobsOptions = {
                    delay: options.delay,
                    repeat: options.repeat && {
                        cron: options.repeat.cron,
                        immediately: options.repeat.immediate
                    }
                };

                instance = instance || new Queue(name, { connection: this.connection });
                return instance.add(options.name || "", options.data || {}, jobOptions).then(job => convertJob(job));
            },
            process: options => {
                const worker = new Worker(name, job => options.callback(convertJob(job)), { 
                    concurrency: options.concurrency,
                    connection: this.connection
                });

                // BullMQ recommends attaching to 'error' and since we don't get job info pass the error to the logger
                // https://docs.bullmq.io/guide/workers
                worker.on("error", error => this.logger.logError(error));
                worker.on("active", job => {
                    this.logger.logDebug({ name: "BullMQ - job active", queueName: job.queueName, job: job.id });
                    jobActive.tryEmit(() => ({ job: convertJob(job) }));
                });
                worker.on("completed", (job, returnValue) => {
                    this.logger.logDebug({ name: "BullMQ - job completed", queueName: job.queueName, job: job.id });
                    jobCompleted.tryEmit(() => ({ job: convertJob(job), returnValue }));
                });
                worker.on("failed", (job, error) => {
                    this.logger.logWarn({ name: "BullMQ - job failed", queueName: job.queueName, job: job.id, message: error.message, stack: error.stack });
                    jobFailed.tryEmit(() => ({ job: convertJob(job), error }));
                });
                worker.on("progress", (job, progress) => {
                    this.logger.logDebug({ name: "BullMQ - job progress", queueName: job.queueName, job: job.id, progress: typeof progress === "number" ? progress : JSON.stringify(progress) });
                    jobProgress.tryEmit(() => ({ job: convertJob(job), progress }));
                });

                return worker;
            }
        };
    }

    private initializeSchedulers(queueSchedulers: string[]): void {
        // TODO: is support needed to close the schedulers?
        queueSchedulers.forEach(name => new QueueScheduler(name, { connection: this.connection }));
    }
}

class QueueEventEmitter<TArgs> extends EventEmitter<TArgs> {
    tryEmit(getArgs: () => TArgs): Promise<void> {
        return this.count ? super.emit(getArgs()) : Promise.resolve();
    }
}