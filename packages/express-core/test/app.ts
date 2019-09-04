import * as express from "express";
import { createExpressHostBuilder, ExpressCoreModule } from "../src";

export async function createApp(): Promise<express.Express> {
    const host = createExpressHostBuilder()
        .useModules([ExpressCoreModule])
        .build();

    await host.load();

    return host.app;
}