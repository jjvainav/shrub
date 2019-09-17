import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import { createBundleRenderer } from "vue-server-renderer";
import { IVueSSRContext } from "@shrub/vue-server";

export interface IStaticViewOptions {
    readonly name: string;
}

export interface ISSRViewOptions {
    readonly context?: IVueSSRContext;
    readonly bundlePath: string;
    readonly clientManifestPath: string;
    readonly templatePath: string;
}

const fileCache: { [name: string]: any } = {};

export abstract class BaseController {
    /** Handles Vue SSR rendered views. */
    protected ssrView(req: Request, res: Response, next: NextFunction, options: ISSRViewOptions): void {
        const context = options.context || {};
        const bundle = this.readFileAsJson(options.bundlePath);
        const clientManifest = this.readFileAsJson(options.clientManifestPath);
        const template = this.readFileAsText(options.templatePath);
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
    }

    private readFileAsText(path: string): string {
        if (!fileCache[path]) {
            fileCache[path] = fs.readFileSync(path, "utf-8");
        }
    
        return fileCache[path];
    }
    
    private readFileAsJson(path: string): any {
        if (!fileCache[path]) {
            fileCache[path] = JSON.parse(fs.readFileSync(path, "utf-8"));
        }
    
        return fileCache[path];
    }
}