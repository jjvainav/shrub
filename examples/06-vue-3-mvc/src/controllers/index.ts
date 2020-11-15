import { NextFunction, Request, Response } from "express";
import * as path from "path";
import { Route, Get } from "@shrub/express";

interface IStaticViewOptions {
    readonly name: string;
}

@Route()
export class Controller {
    @Get()
    getIndex(req: Request, res: Response, next: NextFunction): void {
        this.staticView(res, { name: "index" });
    }

    @Get("/hello")
    getHello(req: Request, res: Response, next: NextFunction): void {
        this.staticView(res, { name: "hello" });
    }

    @Get("/counter")
    getCounter(req: Request, res: Response, next: NextFunction): void {
        this.staticView(res, { name: "counter" });
    }

    private staticView(res: Response, options: IStaticViewOptions): void {
        res.sendFile("/index.html", { root: path.join(__dirname, "../views", options.name) });
    }
}