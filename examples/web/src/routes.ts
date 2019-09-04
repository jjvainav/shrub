import * as express from "express";
import { useController } from "@shrub/express-core";
import { WorkbenchController } from "./controllers";

export function createRoutes(): express.Router {
    const router = express.Router();

    const middleware = express.static(__dirname);
    router.get(/\/public(.*)/, (req, res, next) => middleware(req, res, err => {
        if (err) {
            return next(err);
        }
    
        // The static middleware will invoke next if a static file is not found;
        // instead of cascading down to the workbench controller return a 404 status.
        res.status(404).end();
    }));

    router.use(useController(WorkbenchController));

    return router;
}