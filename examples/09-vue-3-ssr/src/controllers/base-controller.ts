import { Request, Response } from "express";
import * as path from "path";
import { renderToString } from "vue/server-renderer";

export interface ISSRViewOptions {
    /** The name of the server manifest file; the default is 'manifest.js' and is loaded from the viewBase directory. */
    readonly manifest?: string;
    /** The name of the view and is expected to be the name of the view directory. */
    readonly view: string;
    /** The name of handlebars view template; the default is 'index'. */
    readonly template?: string;
}

export abstract class BaseController {
    /** Handles Vue SSR rendered views. */
    protected async ssrView(req: Request, res: Response, options: ISSRViewOptions): Promise<void> {
        const appPath = path.join(__dirname, '../views', options.view, options.manifest || "manifest.js");
        const loadApp = await import(appPath).then(value => value.default);
        const appContext = await loadApp();

        await appContext.router.push(req.originalUrl);
        await appContext.router.isReady();

        const appContent = await renderToString(appContext.app);

        const view = path.join(options.view, options.template || "index");
        res.render(view, { app: appContent, layout: false });
    }
}