import { RequestHandler } from "express";
import * as path from "path";

export interface IStaticViewOptions {
    readonly fileName: string;
    readonly viewName: string;
}

/** Handles serving static file views (e.g. html files). */
export function staticView(options: IStaticViewOptions): RequestHandler {
    return (req, res) => res.sendFile(options.fileName, {
        root: path.join(__dirname, "views", options.viewName)
    });
}