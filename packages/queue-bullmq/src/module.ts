import { createConfig, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/core";
import { ILogger, ILoggingService, LoggingModule } from "@shrub/logging";
import { IJob, IJobActiveEventArgs, IJobCompletedEventArgs, IJobFailedEventArgs, IJobOptions, IJobProgressEventArgs, 
    IQueue, IQueueConfiguration, IWorker, IWorkerOptions, QueueAdapter, QueueAdapterCollection, QueueModule, WorkerCallback
} from "@shrub/queue";
import { EventEmitter } from "@sprig/event-emitter";
import { ConnectionOptions, Job, JobsOptions, Queue, QueueEvents, Worker, WorkerListener } from "bullmq";

export { ConnectionOptions };

type WorkerListenerArgsConverter<T extends keyof WorkerListener, TResult> = (...args: Parameters<WorkerListener[T]>) => TResult;

export interface IQueueBullMQConfiguration {
    /** Enables the use of the a BullMQ job queue. */
    useQueue(options: IQueueBullMQOptions): void;
}

/** Defines options for the BullMQ job queue. */
export interface IQueueBullMQOptions {
    /** BullMQ connection options for connecting to Redis. */
    readonly connection: ConnectionOptions;
    /** True to enable queue events that are required when waiting for jobs to finish; this is false by default. */
    readonly enableEvents?: boolean;
    /** A set of queue name patterns defining the queues the BullMQ adapter will handle; if not defined, BullMQ job queue will be used for all queues. */
    readonly queueNamePatterns?: string[];
}

export const IQueueBullMQConfiguration = createConfig<IQueueBullMQConfiguration>();

export class QueueBullMQModule implements IModule {
    private readonly adapters = new QueueAdapterCollection();

    readonly name = "queue-bullmq";
    readonly dependencies = [
        LoggingModule,
        QueueModule
    ];

    initialize(init: IModuleInitializer): void {
        init.config(IQueueBullMQConfiguration).register(({ services }) => ({
            useQueue: options => this.adapters.addQueueAdapter(new QueueBullMQAdapter(
                services.get(ILoggingService).createLogger(),
                options.connection,
                !!options.enableEvents,
                options.queueNamePatterns))
        }));
    }

    configure({ config }: IModuleConfigurator): void {
        config.get(IQueueConfiguration).useQueue(this.adapters.asQueueAdapter());
    }

    dispose(): Promise<void> {
        return this.adapters.dispose();
    }
}

export class QueueBullMQAdapter extends QueueAdapter {
    constructor(
        private readonly logger: ILogger,
        private readonly connection: ConnectionOptions,
        private readonly enableEvents: boolean,
        queueNamePatterns?: string[]) {
            super(queueNamePatterns || ["*"]);
    }

    protected getQueueInstance(name: string): IQueue {
        return new BullMQWrapper(this.logger, this.connection, this.enableEvents, name);
    }
}

class BullMQWrapper implements IQueue {
    private readonly workers = new Map<number, Worker>();

    private events?: QueueEvents;
    private instance?: Queue;
    private workerId = 1;

    constructor(
        private readonly logger: ILogger,
        private readonly connection: ConnectionOptions,
        enableEvents: boolean,
        readonly name: string) {
            if (enableEvents) {
                this.events = new QueueEvents(name, { connection });
            }
    }

    async add(options: IJobOptions): Promise<IJob> {
        const jobOptions: JobsOptions = {
            jobId: options.id,
            delay: options.delay,
            repeat: options.repeat && {
                pattern: options.repeat.cron,
                immediately: options.repeat.immediate
            }
        };

        if (this.events) {
            await this.events.waitUntilReady();
        }

        return this.getInstance().add(options.name || "", options.data || {}, jobOptions).then(job => this.convertJob(job));
    }

    async close(): Promise<void> {
        const promises = Array.from(this.workers.values()).map(worker => worker.close());
        this.workers.clear();

        if (this.instance) {
            promises.push(this.instance.close());
            this.instance = undefined;
        }

        if (this.events) {
            promises.push(this.events.close());
            this.events = undefined;
        }

        await Promise.all(promises);
    }

    createWorker(optionsOrCallback: IWorkerOptions | WorkerCallback): IWorker {
        const options = this.getWorkerOptions(optionsOrCallback);
        const worker = new Worker(this.name, job => options.callback(this.convertJob(job)), { 
            autorun: true,
            concurrency: options.concurrency || 1,
            connection: this.connection
        });

        const jobActive = new WorkerEventEmitter<IJobActiveEventArgs, "active">(worker, "active", job => ({ job: this.convertJob(job) }));
        const jobCompleted = new WorkerEventEmitter<IJobCompletedEventArgs, "completed">(worker, "completed", (job, returnValue) => ({ job: this.convertJob(job), returnValue }));
        const jobFailed = new WorkerEventEmitter<IJobFailedEventArgs, "failed">(worker, "failed", (job, error) => ({ job: job && this.convertJob(job), error }));
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
            },
            waitUntilReady: () => worker.waitUntilReady().then(() => {})
        };
    }

    async waitUntilReady(): Promise<void> {
        await this.getInstance().waitUntilReady();
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
            waitUntilFinished: async () => {
                if (!this.events) {
                    throw new Error("enableEvents must be true in order to wait for a job to finish.");
                }

                return job.waitUntilFinished(this.events);
            }
        };
    }

    private getInstance(): Queue {
        this.instance = this.instance || new Queue(this.name, { connection: this.connection });
        return this.instance;
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