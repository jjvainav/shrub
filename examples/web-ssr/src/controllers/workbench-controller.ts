import { NextFunction, Request, Response } from "express";
import * as path from "path";
import { Get, Route } from "@shrub/express";
import { ssrViewHandler } from "../handlers";

const viewHandler = ssrViewHandler({
    context: { title: "Examples" },
    bundlePath: path.join(__dirname, "../views/workbench/server-bundle.json"),
    clientManifestPath: path.join(__dirname, "../public/workbench-client-manifest.json"),
    templatePath: path.join(__dirname, "../views/workbench/template.html")
});

@Route("*")
export class WorkbenchController {
    @Get("/")
    get(req: Request, res: Response, next: NextFunction): void {
        viewHandler(req, res, next);       
    }
}