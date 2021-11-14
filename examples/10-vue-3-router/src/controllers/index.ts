import { NextFunction, Request, Response } from "express";
import * as path from "path";
import { Route, Get } from "@shrub/express";

@Route("*")
export class Controller {
    @Get()
    getIndex(req: Request, res: Response, next: NextFunction): void {
        res.sendFile("/index.html", { root: path.join(__dirname, "../views/main") });
    }
}