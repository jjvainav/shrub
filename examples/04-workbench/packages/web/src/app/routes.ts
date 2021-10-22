import * as express from "express";
import { controller } from "@shrub/express";
import { WorkbenchController } from "./controllers";

export function createRoutes(): express.Router {
    const router = express.Router();

    router.get("/favicon.ico", (req, res) => res.status(204).end());
    router.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));
    router.use(controller(WorkbenchController));

    return router;
}