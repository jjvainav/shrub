import * as express from "express";
import { ExpressFactory } from "../src";

export function createApp(): Promise<express.Application> {
    return ExpressFactory.createServer().then(server => server.app);
}