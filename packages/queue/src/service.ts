import { createService, Singleton } from "@shrub/core";
import { IQueue, IQueueAdapter, QueueAdapterCollection } from "./queue";

export interface IQueueService {
    getQueue<TData = any, TReturnValue = any>(name: string | IQueueName<TData, TReturnValue>): IQueue<TData, TReturnValue>;
}

export interface IQueueName<TData = any, TReturnValue = any> {
    readonly name: string;
}

/** @internal */
export interface IQueueAdapterService {
    /** Registers an adapter with the service; an adapter is responsible for providing access to an internal queue based on the queue name. */
    register(adapter: IQueueAdapter): void;
}

export const createQueueName = <TData = any, TReturnValue = any>(name: string): IQueueName<TData, TReturnValue> => ({ name });

export const IQueueService = createService<IQueueService>("queue-service");

/** @internal */
export const IQueueAdapterService = createService<IQueueAdapterService>("queue-adapter-service");

/** @internal */
@Singleton
export class QueueService implements IQueueService, IQueueAdapterService {
    private readonly adapters = new QueueAdapterCollection();

    getQueue(queueName: string | IQueueName): IQueue {
        const name = typeof queueName === "string" ? queueName : queueName.name;
        const queue = this.adapters.asQueueAdapter().getQueue(name);

        if (!queue) {
            throw new Error(`No queue adapter found to handle queue with name (${name}).`);
        }

        return queue;
    }

    register(adapter: IQueueAdapter): void {
        this.adapters.addQueueAdapter(adapter);
    }
}