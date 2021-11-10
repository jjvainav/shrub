import * as express from "express";
import * as hbs from "express-handlebars";
import * as path from "path";
import { controller, ExpressFactory } from "@shrub/express";
import { AppController } from "./controllers";

async function start() {
    const app = await ExpressFactory.create();

    app.engine("hbs", hbs());

    app.set("port", process.env.PORT || 3000);
    app.set("view engine", "hbs");
    app.set("views", path.resolve(__dirname, "views"));
    
    app.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));
    app.use(controller(AppController));
    
    app.listen(app.get("port"), () => {
        console.log("  App started at http://localhost:%d", app.get("port"));
        console.log("  App running");
        console.log("  Press CTRL-C to stop\n");
    });
}

start();