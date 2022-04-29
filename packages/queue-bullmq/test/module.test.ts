import { IJob, IQueue } from "@shrub/queue";
import createId from "@sprig/unique-id";
import { setup } from "./setup";
import { removeAllQueueData } from "./utils";

describe("module", () => {
    let queue: IQueue;

    beforeEach(async () => {
        const context = await setup();
        queue = context.queueService.getQueue("test-queue-" + createId());
    });

    afterEach(async () => {
        await queue.close();
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
});