import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogger, ILoggingService, LoggingModule } from "@shrub/logging";
import { IJob, IJobActiveEventArgs, IJobCompletedEventArgs, IJobFailedEventArgs, IJobOptions, IJobProgressEventArgs, 
    IQueue, IQueueConfiguration, IWorker, IWorkerOptions, QueueAdapter, QueueModule, WorkerCallback
} from "@shrub/queue";
import { EventEmitter } from "@sprig/event-emitter";
import { ConnectionOptions, Job, JobsOptions, Queue, QueueEvents, QueueScheduler, Worker, WorkerListener } from "bullmq";

export { ConnectionOptions };

type WorkerListenerArgsConverter<T extends keyof WorkerListener, TResult> = (...args: Parameters<WorkerListener[T]>) => TResult;

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

export const IQueueBullMQConfiguration = createConfig<IQueueBullMQConfiguration>();

export class QueueBullMQModule implements IModule {
    private readonly adapters: QueueBullMQAdapter[] = [];

    readonly name = "queue-bullmq";
    readonly dependencies = [
        LoggingModule,
        QueueModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IQueueBullMQConfiguration).register(({ services }) => ({
            useQueue: options => this.adapters.push(new QueueBullMQAdapter(
                services.get(ILoggingService).createLogger(),
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

export class QueueBullMQAdapter extends QueueAdapter {
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
    private readonly workers = new Map<number, Worker>();

    private readonly events: QueueEventsReference;
    private instance?: Queue;
    private workerId = 1;

    constructor(
        private readonly logger: ILogger,
        private readonly queueName: string,
        private readonly connection?: ConnectionOptions) {
            this.events = new QueueEventsReference(queueName, connection);
    }

    add(options: IJobOptions): Promise<IJob> {
        const jobOptions: JobsOptions = {
            jobId: options.id,
            delay: options.delay,
            repeat: options.repeat && {
                cron: options.repeat.cron,
                immediately: options.repeat.immediate
            }
        };

        this.instance = this.instance || new Queue(this.queueName, { connection: this.connection });
        return this.instance.add(options.name || "", options.data || {}, jobOptions).then(job => this.convertJob(job));
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
        const worker = new Worker(this.queueName, job => options.callback(this.convertJob(job)), { 
            concurrency: options.concurrency,
            connection: this.connection
        });

        const jobActive = new WorkerEventEmitter<IJobActiveEventArgs, "active">(worker, "active", job => ({ job: this.convertJob(job) }));
        const jobCompleted = new WorkerEventEmitter<IJobCompletedEventArgs, "completed">(worker, "completed", (job, returnValue) => ({ job: this.convertJob(job), returnValue }));
        const jobFailed = new WorkerEventEmitter<IJobFailedEventArgs, "failed">(worker, "failed", (job, error) => ({ job: this.convertJob(job), error }));
        const jobProgress = new WorkerEventEmitter<IJobProgressEventArgs, "progress">(worker, "progress", (job, progress) => ({ job: this.convertJob(job), progress }));

        // BullMQ recommends attaching to 'error' and since we don't get job info pass the error to the logger
        // https://docs.bullmq.io/guide/workers
        worker.on("error", error => this.logger.logError(error));

        const id = this.workerId++;
        this.workers.set(id, worker);

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

    private convertJob(job: Job): IJob {
        return {
            id: job.id || "",
            name: job.name,
            data: job.data,
            get isActive() {
                return job.isActive();
            },
            get isCompleted() {
                return job.isCompleted();
            },
            get isFailed() {
                return job.isFailed();
            },
            get progress() {
                return job.progress;
            },
            updateProgress: progress => job.updateProgress(progress),
            waitUntilFinished: () => job.waitUntilFinished(this.events.getInstance()).finally(() => this.events.releaseInstance())
        };
    }

    private getWorkerOptions(optionsOrCallback: IWorkerOptions | WorkerCallback): IWorkerOptions {
        return typeof optionsOrCallback === "function" ? { callback: optionsOrCallback } : optionsOrCallback;
    }
}

class WorkerEventEmitter<TArgs, T extends keyof WorkerListener> extends EventEmitter<TArgs> {
    private readonly listener: WorkerListener[T];

    constructor(
        private readonly worker: Worker,
        private readonly name: T, 
        private readonly convertArgs: WorkerListenerArgsConverter<T, TArgs>) {
        super();
        this.listener = <WorkerListener[T]>((...args: Parameters<WorkerListener[T]>) => {
            this.emit(this.convertArgs(...args));
        });
    }

    protected callbackRegistered(): void {
        if (this.count === 1) {
            this.worker.on(this.name, this.listener);
        }
    }

    protected callbackUnregistered(): void {
        if (this.count === 0) {
            this.worker.off(this.name, this.listener);
        }
    }
}

/** 
 * Manages a reference to a QueueEvents object and will close the connection when all references have been released. 
 * BullMQ uses Redis Streams so only open a connection when necessary. 
 */
class QueueEventsReference {
    private events?: QueueEvents;
    private count = 0;

    constructor(
        private readonly queueName: string,
        private readonly connection?: ConnectionOptions) {
    }

    getInstance(): QueueEvents {
        this.events = this.events || new QueueEvents(this.queueName, { connection: this.connection });
        this.count++;
        return this.events;
    }

    releaseInstance(): void {
        this.count--;
        if (!this.count && this.events) {
            this.events.close();
            this.events = undefined;
        }
    }
}