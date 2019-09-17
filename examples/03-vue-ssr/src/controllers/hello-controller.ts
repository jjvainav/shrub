import { NextFunction, Request, Response } from "express";
import * as path from "path";
import { Route, Get } from "@shrub/express";
import { BaseController } from "./base-controller";

@Route()
export class HelloController extends BaseController {
    @Get()
    get(req: Request, res: Response, next: NextFunction): void {
        this.ssrView(req, res, next, {
            context: { title: "Hello!" },
            bundlePath: path.join(__dirname, "../views/hello/server-bundle.json"),
            clientManifestPath: path.join(__dirname, "../public/hello-client-manifest.json"),
            templatePath: path.join(__dirname, "../views/hello/index.html")
        })
    }
}