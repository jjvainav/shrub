import { Route, Get } from "@shrub/express";
import { NextFunction, Request, Response } from "express";
import { BaseController } from "./base-controller";

@Route("*")
export class AppController extends BaseController {
    @Get()
    get(req: Request, res: Response, next: NextFunction): void {
        this.ssrView(req, res, { view: "app" });
    }
}