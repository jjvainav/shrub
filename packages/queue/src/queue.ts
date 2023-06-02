import { IEvent } from "@sprig/event-emitter";
import { QueueAdapterWhitelist } from "./whitelist";

export type WorkerCallback<TData = any, TReturnValue = void> = (job: IJob<TData, TReturnValue>) => Promise<TReturnValue>;

/** Defines the API for a queue. */
export interface IQueue<TData = any, TReturnValue = any> {
    /** The name of the queue. */
    readonly name: string;
    /** Adds a job to the queue. */
    add(options: IJobOptions<TData>): Promise<IJob<TData, TReturnValue>>;
    /** Closes the queue and all workers associated with the queue. */
    close(): Promise<void>;
    /** Creates a new worker for handling/processing jobs. */
    createWorker(optionsOrCallback: IWorkerOptions<TData> | WorkerCallback<TData, TReturnValue>): IWorker;
    /** Waits until the queue is ready for processing. */
    waitUntilReady(): Promise<void>;
}

/** Responsible for providing access to a queue. */
export interface IQueueAdapter {
    /** Optional callback to dispose the adapter. */
    readonly dispose?: () => Promise<void>;
    /** Gets a queue with the specified name or undefined if the adapter does not support/recognize the given queue name. */
    getQueue(name: string): IQueue | undefined;
}

/** Represents a specific instance of a job in the queue. */
export interface IJob<TData = any, TReturnValue = any> {
    readonly id: string;
    readonly name: string;
    readonly data: TData;
    readonly isActive: Promise<boolean>;
    readonly isCompleted: Promise<boolean>;
    readonly isFailed: Promise<boolean>;
    readonly progress: number | object;
    updateProgress(progress: number | object): Promise<void>;
    waitUntilFinished(): Promise<TReturnValue>;
}

/** Defines options for creating jobs. */
export interface IJobOptions<TData = any> {
    /** An optional id to assign to the job; if not provided, the queue will assign a unique id. */
    readonly id?: string;
    /** A name for the job. */
    readonly name?: string;
    /** Data to pass to the job. */
    readonly data?: TData;
    /** The amount of time (in milliseconds) to delay before the job can be processed; if not defined, the job can be processed immediately. */
    readonly delay?: number;
    /** Options for repeatable jobs. */
    readonly repeat?: IJobRepeatOptions;
}

/** Defines options for a repeatable job. */
export interface IJobRepeatOptions {
    /** A cron expression descrribing the repeat pattern. */
    readonly cron?: string;
    /** True if the job should be queued immeiately for execution; otherwise, the first job won't be scheduled until the next cron time. The default is false. */
    readonly immediate?: boolean;
}

/** Defines options for registering a process for handling jobs. */
export interface IWorkerOptions<TData = any, TReturnValue = any> {
    /** A callback for handling jobs. */
    readonly callback: WorkerCallback<TData, TReturnValue>;
    /** Optionally specifies the maximum number of parallel jobs that can be processed at once; if not specified, the underlying queue's default will be used. */
    readonly concurrency?: number;
}

/** Defines a worker responsible for processing jobs. */
export interface IWorker<TData = any, TReturnValue = any> {
    /** An event that is raised when a job has becomes active. */
    readonly onJobActive: IEvent<IJobActiveEventArgs<TData, TReturnValue>>;
    /** An event that is raised when a job has completed. */
    readonly onJobCompleted: IEvent<IJobCompletedEventArgs<TData, TReturnValue>>;
    /** An event that is raised when a job has failed. */
    readonly onJobFailed: IEvent<IJobFailedEventArgs<TData, TReturnValue>>;
    /** An event that is raised when a job has reported progress. */
    readonly onJobProgress: IEvent<IJobProgressEventArgs<TData, TReturnValue>>;
    /** Closes the worker and all underlying connections. */
    close(): Promise<void>;
    /** Waits until the worker is ready for processing. */
    waitUntilReady(): Promise<void>;
}

export interface IJobActiveEventArgs<TData = any, TReturnValue = any> {
    readonly job: IJob<TData, TReturnValue>;
}

export interface IJobCompletedEventArgs<TData = any, TReturnValue = any> {
    readonly job: IJob<TData, TReturnValue>;
    readonly returnValue: any;
}

export interface IJobFailedEventArgs<TData = any, TReturnValue = any> {
    readonly job?: IJob<TData, TReturnValue>;
    readonly error: Error;
}

export interface IJobProgressEventArgs<TData = any, TReturnValue = any> {
    readonly job: IJob<TData, TReturnValue>;
    readonly progress: number | object;
}

/** Base class for a queue adapter that accepts a set of names/patterns defining the queue(s) the adapter supports. */
export abstract class QueueAdapter implements IQueueAdapter {
    private readonly whitelist: QueueAdapterWhitelist;

    constructor(queueNamePatterns: string[]) {
        this.whitelist = new QueueAdapterWhitelist(queueNamePatterns);
    }

    addQueueNamePatterns(queueNamePatterns: string[]): void {
        queueNamePatterns.forEach(pattern => this.whitelist.add(pattern));
    }

    getQueue(name: string): IQueue | undefined {
        return this.whitelist.isQueueSupported(name) ? this.getQueueInstance(name) : undefined;
    }

    protected abstract getQueueInstance(name: string): IQueue;

    protected getWorkerOptions(optionsOrCallback: IWorkerOptions | WorkerCallback): IWorkerOptions {
        return typeof optionsOrCallback === "function" ? { callback: optionsOrCallback } : optionsOrCallback;
    }
}

/** A collection of queue adaters and also exposes a queue adapter contract for requesting queues from the collection. */
export class QueueAdapterCollection {
    private readonly adapters: IQueueAdapter[] = [];

    addQueueAdapter(adapter: IQueueAdapter): void {
        this.adapters.push(adapter);
    }

    asQueueAdapter(): IQueueAdapter {
        return {
            getQueue: name => {
                for (const adapter of this.adapters) {
                    const queue = adapter.getQueue(name);
                    if (queue) {
                        return queue;
                    }
                }
        
                return undefined;
            }
        };
    }

    async dispose(): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const adapter of this.adapters.splice(0)) {
            if (adapter.dispose) {
                promises.push(adapter.dispose());
            }
        }

        await Promise.all(promises);
    }
}