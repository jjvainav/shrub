import * as express from "express";
import * as path from "path";
import { controller, ExpressFactory } from "@shrub/express";
import { HelloController } from "./controllers";

async function start() {
    const app = await ExpressFactory.create();

    app.set("port", process.env.PORT || 3000);
    app.set("views", path.resolve(__dirname, "views"));
    
    app.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));
    app.use(controller(HelloController));
    
    app.listen(app.get("port"), () => {
        console.log("  App started at http://localhost:%d", app.get("port"));
        console.log("  App running");
        console.log("  Press CTRL-C to stop\n");
    });
}

start();