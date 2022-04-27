import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogger, LoggingModule } from "@shrub/logging";
import { IJob, IJobActiveEventArgs, IJobCompletedEventArgs, IJobFailedEventArgs, IJobOptions, IJobProgressEventArgs, 
    IQueue, IQueueConfiguration, IWorker, IWorkerOptions, QueueAdapter, QueueModule, WorkerCallback
} from "@shrub/queue";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { ConnectionOptions, Job, JobsOptions, Queue, QueueScheduler, Worker } from "bullmq";

export { ConnectionOptions };

export interface IQueueBullMQConfiguration {
    /** Enables the use of the a BullMQ job queue. */
    useQueue(options?: IQueueBullMQOptions): void;
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
        name: job.name,
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
            useQueue: options => this.adapters.push(new BullMQQueueAdapter(
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
        return new BullMQWrapper(this.logger, name, this.connection);
    }

    private initializeSchedulers(queueSchedulers: string[]): void {
        // TODO: is support needed to close the schedulers?
        queueSchedulers.forEach(name => new QueueScheduler(name, { connection: this.connection }));
    }
}

class BullMQWrapper implements IQueue {
    private readonly jobActive = new QueueEventEmitter<IJobActiveEventArgs>();
    private readonly jobCompleted = new QueueEventEmitter<IJobCompletedEventArgs>();
    private readonly jobFailed = new QueueEventEmitter<IJobFailedEventArgs>();
    private readonly jobProgress = new QueueEventEmitter<IJobProgressEventArgs>();
    private readonly workers = new Map<number, Worker>();

    private instance?: Queue;
    private workerId = 1;

    constructor(
        private readonly logger: ILogger,
        private readonly queueName: string,
        private readonly connection?: ConnectionOptions) {
    }

    get onJobActive(): IEvent<IJobActiveEventArgs> {
        return this.jobActive.event;
    }

    get onJobCompleted(): IEvent<IJobCompletedEventArgs> {
        return this.jobCompleted.event;
    }

    get onJobFailed(): IEvent<IJobFailedEventArgs> {
        return this.jobFailed.event;
    }

    get onJobProgress(): IEvent<IJobProgressEventArgs> {
        return this.jobProgress.event;
    }

    add(options: IJobOptions): Promise<IJob> {
        const jobOptions: JobsOptions = {
            delay: options.delay,
            repeat: options.repeat && {
                cron: options.repeat.cron,
                immediately: options.repeat.immediate
            }
        };

        this.instance = this.instance || new Queue(this.queueName, { connection: this.connection });
        return this.instance.add(options.name || "", options.data || {}, jobOptions).then(job => convertJob(job));
    }

    async close(): Promise<void> {
        const promises = Array.from(this.workers.values()).map(worker => worker.close());
        this.workers.clear();

        if (this.instance) {
            promises.push(this.instance.close());
            this.instance = undefined;
        }

        await Promise.all(promises);
    }

    createWorker(optionsOrCallback: IWorkerOptions | WorkerCallback): IWorker {
        const options = this.getWorkerOptions(optionsOrCallback);
        const worker = new Worker(this.queueName, job => options.callback(convertJob(job)), { 
            concurrency: options.concurrency,
            connection: this.connection
        });

        // BullMQ recommends attaching to 'error' and since we don't get job info pass the error to the logger
        // https://docs.bullmq.io/guide/workers
        worker.on("error", error => this.logger.logError(error));
        worker.on("active", job => {
            this.logger.logDebug({ name: "BullMQ - job active", queueName: job.queueName, job: job.id });
            this.jobActive.tryEmit(() => ({ job: convertJob(job) }));
        });
        worker.on("completed", (job, returnValue) => {
            this.logger.logDebug({ name: "BullMQ - job completed", queueName: job.queueName, job: job.id });
            this.jobCompleted.tryEmit(() => ({ job: convertJob(job), returnValue }));
        });
        worker.on("failed", (job, error) => {
            this.logger.logWarn({ name: "BullMQ - job failed", queueName: job.queueName, job: job.id, message: error.message, stack: error.stack });
            this.jobFailed.tryEmit(() => ({ job: convertJob(job), error }));
        });
        worker.on("progress", (job, progress) => {
            this.logger.logDebug({ name: "BullMQ - job progress", queueName: job.queueName, job: job.id, progress: typeof progress === "number" ? progress : JSON.stringify(progress) });
            this.jobProgress.tryEmit(() => ({ job: convertJob(job), progress }));
        });

        const id = this.workerId++;
        this.workers.set(id, worker);

        return {
            close: () => {
                const worker = this.workers.get(id);
                if (worker) {
                    this.workers.delete(id);
                    return worker.close();
                }

                return Promise.resolve();
            }
        };
    }

    private getWorkerOptions(optionsOrCallback: IWorkerOptions | WorkerCallback): IWorkerOptions {
        return typeof optionsOrCallback === "function" ? { callback: optionsOrCallback } : optionsOrCallback;
    }
}

class QueueEventEmitter<TArgs> extends EventEmitter<TArgs> {
    tryEmit(getArgs: () => TArgs): Promise<void> {
        return this.count ? super.emit(getArgs()) : Promise.resolve();
    }
}