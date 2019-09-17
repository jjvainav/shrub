import { Response } from "express";
import * as path from "path";

export interface IStaticViewOptions {
    readonly name: string;
}

export abstract class BaseController {
    /** Handles serving static file views (e.g. html files). */
    protected staticView(res: Response, options: IStaticViewOptions): void {
        res.sendFile("/index.html", { root: path.join(__dirname, "../views", options.name) });
    }
}