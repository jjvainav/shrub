import { NextFunction, Request, Response } from "express";
import { Route, Get } from "@shrub/express";
import { BaseController } from "./base-controller";

@Route()
export class IndexController extends BaseController {
    @Get()
    get(req: Request, res: Response, next: NextFunction): void {
        this.staticView(res, { name: "index" });
    }
}