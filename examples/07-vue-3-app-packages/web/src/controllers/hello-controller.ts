import { NextFunction, Request, Response } from "express";
import { Route, Get } from "@shrub/express";
import { BaseController } from "./base-controller";

@Route("/hello")
export class HelloController extends BaseController {
    @Get()
    get(req: Request, res: Response, next: NextFunction): void {
        this.staticView(res, { name: "hello" });
    }
}