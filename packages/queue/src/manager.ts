import { IJob, IJobRepeatOptions, IQueue, IWorker, WorkerCallback } from "./queue";
import { IQueueService } from "./service";

export type JobData<T> = T extends JobType<infer TData> ? TData : never;
export type JobReturnValue<T> = T extends JobType<any, infer TReturnValue> ? TReturnValue : never;
export type JobType<TData = any, TReturnValue = void> = {};
export type JobTypes = { [key: string]: JobType<any> };

/** A helper class responsible for managing multiple queues. The manager will maintain a single instance of each queue as they are referenced. */
export class QueueManager<TJobTypes extends JobTypes> {
    private readonly queues = new Map<keyof TJobTypes, IQueue>();
    private isDisposed = false;

    constructor(
        private readonly queueService: IQueueService,
        private readonly queuePrefix = "") {
    }

    add<T extends keyof TJobTypes>(name: T, data: JobData<TJobTypes[T]>, repeat?: IJobRepeatOptions): Promise<IJob<JobData<TJobTypes[T]>, JobReturnValue<TJobTypes[T]>> | undefined> {
        return !this.isDisposed ? this.getQueue(name).add({ name: name.toString(), data, repeat }) : Promise.resolve(undefined);
    }

    async close<T extends keyof TJobTypes>(name?: T): Promise<void> {
        if (name) {
            const queue = this.queues.get(name);
            this.queues.delete(name);
            return queue ? queue.close() : Promise.resolve();
        }

        const queues = Array.from(this.queues.values());
        this.queues.clear();
        await Promise.all(queues.map(queue => queue.close()));
    }

    dispose(): Promise<void> {
        if (!this.isDisposed) {
            this.isDisposed = true;
            return this.close();
        }

        return Promise.resolve();
    }

    process<T extends keyof TJobTypes>(name: T, callback: WorkerCallback<JobData<TJobTypes[T]>, JobReturnValue<TJobTypes[T]>>): IWorker<JobData<TJobTypes[T]>, JobReturnValue<TJobTypes[T]>> | undefined {
        return !this.isDisposed ? this.getQueue(name).createWorker(callback) : undefined;
    }

    private getQueue(jobName: keyof TJobTypes): IQueue {
        const queueName = this.queuePrefix + jobName;
        let queue = this.queues.get(queueName);

        if (!queue) {
            queue = this.queueService.getQueue(queueName);
            this.queues.set(queueName, queue);
        }

        return queue;
    }
}