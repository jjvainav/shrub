import { createService, Singleton } from "@shrub/core";
import { IQueue, IQueueAdapter, QueueAdapterCollection } from "./queue";

export interface IQueueService {
    getQueue(name: string): IQueue;
}

/** @internal */
export interface IQueueAdapterService {
    /** Registers an adapter with the service; an adapter is responsible for providing access to an internal queue based on the queue name. */
    register(adapter: IQueueAdapter): void;
}

export const IQueueService = createService<IQueueService>("queue-service");

/** @internal */
export const IQueueAdapterService = createService<IQueueAdapterService>("queue-adapter-service");

/** @internal */
@Singleton
export class QueueService implements IQueueService, IQueueAdapterService {
    private readonly adapters = new QueueAdapterCollection();

    getQueue(name: string): IQueue {
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