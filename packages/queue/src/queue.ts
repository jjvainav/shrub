import { IEvent } from "@sprig/event-emitter";
import { QueueAdapterWhitelist } from "./whitelist";

export type ProcessJobCallback = (job: IJob) => Promise<void | any>;

/** Defines the API for a queue. */
export interface IQueue {
    /** An event that is raised when a job has completed. */
    readonly onJobCompleted: IEvent<IJobCompletedEventArgs>;
    /** An event that is raised when a job has failed. */
    readonly onJobFailed: IEvent<IJobFailedEventArgs>;
    /** An event that is raised when a job has reported progress. */
    readonly onJobProgress: IEvent<IJobProgressEventArgs>;
    /** Adds a job to the queue. */
    add(options: IJobOptions): Promise<IJob>;
    /** Registers a callback for handling/processing jobs. */
    process(options: IProcessOptions): IWorker;
}

/** Responsible for providing access to a queue. */
export interface IQueueAdapter {
    /** Gets a queue with the specified name or undefined if the adapter does not support/recognize the given queue name. */
    getQueue(name: string): IQueue | undefined;
}

/** Represents a specific instance of a job in the queue. */
export interface IJob {
    readonly id: string;
    readonly data: any;
    readonly progress: number | object;
    updateProgress(progress: number | object): Promise<void>;
}

/** Defines options for creating jobs. */
export interface IJobOptions {
    /** A name for the job. */
    readonly name?: string;
    /** Data to pass to the job. */
    readonly data?: any;
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
export interface IProcessOptions {
    /** A callback for handling jobs. */
    readonly callback: ProcessJobCallback;
    /** Optionally specifies the maximum number of parallel jobs that can be processed at once; if not specified, the underlying queue's default will be used. */
    readonly concurrency?: number;
}

/** Defines a worker responsible for processing jobs. */
export interface IWorker {
    /** Closes the worker and all underlying connections. */
    close(): Promise<void>;
}

export interface IJobCompletedEventArgs {
    readonly job: IJob;
    readonly returnValue: any;
}

export interface IJobFailedEventArgs {
    readonly job: IJob;
    readonly error: Error;
}

export interface IJobProgressEventArgs {
    readonly job: IJob;
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
}