import * as express from "express";
import * as path from "path";
import { ExpressFactory, useController } from "@shrub/express";
import { HelloController, IndexController, WorldController } from "./controllers";

async function start() {
    const app = await ExpressFactory.create();

    app.set("port", process.env.PORT || 3000);
    app.set("views", path.resolve(__dirname, "views"));
    
    app.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));
    app.use(useController(HelloController));
    app.use(useController(IndexController));
    app.use(useController(WorldController));
    
    app.listen(app.get("port"), () => {
        console.log("  App started at http://localhost:%d", app.get("port"));
        console.log("  App running");
        console.log("  Press CTRL-C to stop\n");
    });
}

start();