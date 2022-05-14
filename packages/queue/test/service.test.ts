import { createQueueName, IQueueAdapterService, IQueueService, QueueService } from "../src/service";

interface IData {
    readonly foo: string;
    readonly bar: string;
}

interface IReturnValue {
    readonly success: boolean;
}

const testQueue = createQueueName<IData, IReturnValue>("test-queue");

describe("queue service", () => {
    test("verify queue typings", () => {
        const service: IQueueService & IQueueAdapterService = new QueueService();
        service.register({
            getQueue: name => ({
                name,
                add: () => { throw new Error() },
                close: () => { throw new Error() },
                createWorker: () => { throw new Error() },
                waitUntilReady: () => { throw new Error() }
            })
        });

        // not asserting anything just to demonstrate/verify queue typings
        service.getQueue(testQueue);
    });
});