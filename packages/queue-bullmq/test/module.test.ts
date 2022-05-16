import { IJob, IQueue } from "@shrub/queue";
import createId from "@sprig/unique-id";
import { ITestContext, setup } from "./setup";
import { removeAllQueueData } from "./utils";

describe("module", () => {
    let context: ITestContext;
    let queue: IQueue;

    beforeEach(async () => {
        context = await setup();
        queue = context.queueService.getQueue("test-queue-" + createId());
    });

    afterEach(async () => {
        await queue.close();
        await context.done();
        await removeAllQueueData(queue.name);
    });

    test("queue simple job before starting worker", async () => {
        const job = await queue.add({ name: "test-job" });

        let queuedJob: IJob | undefined;
        const worker = queue.createWorker(async job => queuedJob = job);

        await worker.waitUntilReady();
        await job.waitUntilFinished();
        await worker.close();

        expect(queuedJob).toBeDefined();
        expect(queuedJob!.id).toBe(job.id);
    });

    test("queue simple job after starting worker", async () => {
        let queuedJob: IJob | undefined;
        const worker = queue.createWorker(async job => queuedJob = job);
        await worker.waitUntilReady();

        const job = await queue.add({ name: "test-job" });
        await job.waitUntilFinished();
        await worker.close();

        expect(queuedJob).toBeDefined();
        expect(queuedJob!.id).toBe(job.id);
    });

    test("queue simple job that return a result", async () => {
        const worker = queue.createWorker(() => new Promise(resolve => setTimeout(() => resolve("foo"), 0)));
        await worker.waitUntilReady();

        const job = await queue.add({ name: "test-job" });
        const result = await job.waitUntilFinished();
        await worker.close();

        expect(result).toBe("foo");
    });

    test("queue simple job that return an empty object as a result", async () => {
        const worker = queue.createWorker(() => new Promise(resolve => setTimeout(() => resolve({}), 0)));
        await worker.waitUntilReady();

        const job = await queue.add({ name: "test-job" });
        const result = await job.waitUntilFinished();
        await worker.close();

        expect(result).toBeDefined();
    });

    test("queue multiple jobs and wait for each", async () => {
        const worker = queue.createWorker(job => new Promise(resolve => setTimeout(() => resolve(job.data.value), 0)));
        await worker.waitUntilReady();

        const job1 = await queue.add({ name: "test-job", data: { value: 1 } });
        const job2 = await queue.add({ name: "test-job", data: { value: 2 } });
        const job3 = await queue.add({ name: "test-job", data: { value: 3 } });
        const result1 = await job1.waitUntilFinished();
        const result2 = await job2.waitUntilFinished();
        const result3 = await job3.waitUntilFinished();
        await worker.close();

        expect(result1).toBe(1);
        expect(result2).toBe(2);
        expect(result3).toBe(3);
    });

    test("queue multiple jobs and wait for all", async () => {
        const worker = queue.createWorker(job => new Promise(resolve => setTimeout(() => resolve(job.data.value), 0)));
        await worker.waitUntilReady();

        const job1 = await queue.add({ name: "test-job", data: { value: 1 } });
        const job2 = await queue.add({ name: "test-job", data: { value: 1 } });
        const job3 = await queue.add({ name: "test-job", data: { value: 1 } });
        const result = await Promise.all([
            job1.waitUntilFinished(), 
            job2.waitUntilFinished(), 
            job3.waitUntilFinished()
        ]);
        
        await worker.close();

        expect(result[0]).toBe(1);
        expect(result[1]).toBe(1);
        expect(result[2]).toBe(1);
    });

    test("queue multiple simple jobs with the same job name before starting worker", async () => {
        const job1 = await queue.add({ name: "test-job" });
        const job2 = await queue.add({ name: "test-job" });

        const jobs: IJob[] = [];
        const worker = queue.createWorker(async job => jobs.push(job));
        
        await worker.waitUntilReady();
        await job1.waitUntilFinished();
        await job2.waitUntilFinished();
        await worker.close();

        expect(jobs).toHaveLength(2);
    });

    test("queue multiple simple jobs with the same job name after starting worker", async () => {
        const jobs: IJob[] = [];
        const worker = queue.createWorker(async job => jobs.push(job));
        await worker.waitUntilReady();

        const job1 = await queue.add({ name: "test-job" });
        const job2 = await queue.add({ name: "test-job" });
        await job1.waitUntilFinished();
        await job2.waitUntilFinished();
        await worker.close();

        expect(jobs).toHaveLength(2);
    });

    test("queue multiple simple jobs with a custom concurrency higher than 1", async () => {
        const job1 = await queue.add({ name: "test-job" });
        const job2 = await queue.add({ name: "test-job" });
        const job3 = await queue.add({ name: "test-job" });

        const jobs: IJob[] = [];
        const worker = queue.createWorker({
            callback: async job => jobs.push(job),
            concurrency: 10
        });
        
        await worker.waitUntilReady();
        await job1.waitUntilFinished();
        await job2.waitUntilFinished();
        await job3.waitUntilFinished();
        await worker.close();

        expect(jobs).toHaveLength(3);
    });
});