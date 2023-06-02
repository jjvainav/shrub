import IORedis from "ioredis";

export async function removeAllQueueData(queueName: string): Promise<void> {
    const client = new IORedis();
    const pattern = `bull:${queueName}:*`;
    return new Promise<void>((resolve, reject) => {
        const stream = client.scanStream({ match: pattern });
        stream.on("data", async (keys: string[]) => {
            if (keys.length) {
                const pipeline = client.pipeline();
                keys.forEach(key => pipeline.del(key));
                pipeline.exec().catch(error => reject(error));
            }
        });
        stream.on("end", () => resolve());
        stream.on("error", error => reject(error));
    })
    .then(async () => { await client.quit() })
    .catch(async err => {
        await client.quit();
        throw err;
    });
}