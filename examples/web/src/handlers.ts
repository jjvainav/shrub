import { Request, RequestHandler } from "express";
import * as fs from "fs";
import { createBundleRenderer } from "vue-server-renderer";
import { IVueSSRContext } from "@shrub/vue-server";

export interface ISSRViewOptions {
    readonly context?: IVueSSRContext;
    readonly bundlePath: string;
    readonly clientManifestPath: string;
    readonly templatePath: string;
}

export interface IRenderControllerOptions {
    readonly view: string;
    readonly options?: object;
}

export interface IViewControllerOptions {
    readonly fileName: string;
    readonly viewName: string;
}

const fileCache: { [name: string]: any } = {};

/** Handles Vue SSR rendered views. */
export function ssrViewHandler(options: ISSRViewOptions): RequestHandler {
    return (req, res, next) => {
        const context = options.context || {};
        const bundle = readFileAsJson(options.bundlePath);
        const clientManifest = readFileAsJson(options.clientManifestPath);
        const template = readFileAsText(options.templatePath);
        const renderer = createBundleRenderer(bundle, { 
            clientManifest,
            template
        });

        // set the url for the Vue SSR module so that it can properly handle routes when using a vue-router on the client
        context.url = req.url;
        renderer.renderToString(context, (err, html) => {
            if (err) {
                next(err);
            }
            else {
                res.setHeader("Content-Type", "text/html");
                res.end(html);
            }
        });
    };
}

function readFileAsText(path: string): string {
    if (!fileCache[path]) {
        fileCache[path] = fs.readFileSync(path, "utf-8");
    }

    return fileCache[path];
}

function readFileAsJson(path: string): any {
    if (!fileCache[path]) {
        fileCache[path] = JSON.parse(fs.readFileSync(path, "utf-8"));
    }

    return fileCache[path];
}