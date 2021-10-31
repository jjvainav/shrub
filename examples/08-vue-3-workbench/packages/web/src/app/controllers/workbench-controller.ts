import * as history from "connect-history-api-fallback";
import { NextFunction, Request, Response } from "express";
import { Get, Route } from "@shrub/express";
import { staticView } from "../handlers";

const index = "/index.html";
const viewHandler = staticView({
    fileName: index,
    viewName: "workbench"
});

@Route("*")
export class WorkbenchController {
    @Get("/")
    get(req: Request, res: Response, next: NextFunction): void {
        // TODO: verbose should be disabled in prod
        history({ index, verbose: true })(req, res, err => {
            if (err) {
                return next(err);
            }

            viewHandler(req, res, next);
        });
    }
}