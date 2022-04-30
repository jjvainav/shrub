import IORedis from "ioredis";

export async function removeAllQueueData(queueName: string): Promise<void> {
    const client = new IORedis();
    const pattern = `bull:${queueName}:*`;
    return new Promise<void>((resolve, reject) => {
        const stream = client.scanStream({ match: pattern });
        stream.on("data", (keys: string[]) => {
            if (keys.length) {
                const pipeline = client.pipeline();
                keys.forEach(key => pipeline.del(key));
                pipeline.exec().catch(error => reject(error));
            }
        });
        stream.on("end", () => resolve());
        stream.on("error", error => reject(error));
    })
    .finally(() => client.disconnect());
}