import * as express from "express";
import { createExpressHostBuilder, ExpressModule } from "../src";

export async function createApp(): Promise<express.Express> {
    const host = createExpressHostBuilder()
        .useModules([ExpressModule])
        .build();

    await host.load();

    return host.app;
}