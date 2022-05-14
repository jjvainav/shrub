import { JobType, QueueManager } from "../src/manager";
import { IJob, IWorker } from "../src/queue";
import { IQueueAdapterService, IQueueService, QueueService } from "../src/service";

export type TestJobs = {
    bar: JobType<IBarData, IReturnValue>,
    foo: JobType<IFooData, IReturnValue>,
    test: JobType<ITestData>,
    test2: JobType
};

interface IFooData {
    readonly foo: string;
}

interface IBarData {
    readonly bar: string;
}

interface ITestData {
    readonly test: string;
}

interface IReturnValue {
    readonly success: boolean;
}

interface ITestJob<TData = any, TReturnValue = any> extends IJob<TData, TReturnValue> {
    finish(returnValue: TReturnValue): void;
}

interface ITestWorker extends IWorker {
    run(job: IJob): Promise<any>;
}

function createTestJob<TData = any, TReturnValue = any>(name: string, data: TData): ITestJob<TData, TReturnValue> {
    let finish: (returnValue: TReturnValue) => void;
    const waitUntilFinished = new Promise<TReturnValue>(resolve => finish = resolve);

    return {
        id: "1",
        name,
        data,
        finish: returnValue => finish(returnValue),
        isActive: Promise.resolve(true),
        isCompleted: Promise.resolve(false),
        isFailed: Promise.resolve(false),
        progress: 0,
        updateProgress: () => Promise.resolve(),
        waitUntilFinished: () => waitUntilFinished
    };
}

describe("queue manager", () => {
    let manager: QueueManager<TestJobs>;

    beforeEach(() => {
        const service: IQueueService & IQueueAdapterService = new QueueService();
        service.register({
            getQueue: name => ({
                name,
                add: options => Promise.resolve(createTestJob(options.name || "", options.data || {})),
                close: () => Promise.resolve(),
                createWorker: optionsOrCallback => {
                    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : optionsOrCallback.callback;
                    return <IWorker><unknown>{ 
                        run: (job: ITestJob) => callback(job).then(returnValue => {
                            job.finish(returnValue);
                            return returnValue;
                        })
                    };
                },
                waitUntilReady: () => Promise.resolve(),
            })
        });

        manager = new QueueManager(service);
    });

    afterEach(async () => {
        await manager.dispose();
    });

    // these tests are mainly used to test typings for use with the queue manager, so you should not see any typescript errors

    test("process job with typed data and return value", async () => {
        const job = await manager.add("foo", { foo: "foo" });
        const worker = <ITestWorker>manager.process("foo", job => {
            const foo = job.data.foo;
            return Promise.resolve({ success: foo === "foo" });
        });

        worker.run(<ITestJob>job);
        const returnValue = await job!.waitUntilFinished();

        expect(returnValue.success).toBe(true);
    });

    test("process job with typed data but no return value", async () => {
        const job = await manager.add("test", { test: "test" });
        // since the test job does not define a return value it is expected to be void
        const worker = <ITestWorker>manager.process("test", async job => {});

        worker.run(<ITestJob>job);
        const returnValue = await job!.waitUntilFinished();

        expect(returnValue).toBeUndefined();
    });

    test("process job with no typed data or return value", async () => {
        const job = await manager.add("test2", {});
        const worker = <ITestWorker>manager.process("test2", async job => {});

        worker.run(<ITestJob>job);
        const returnValue = await job!.waitUntilFinished();

        expect(returnValue).toBeUndefined();
    });
});