import * as express from "express";
import * as path from "path";
import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { Controller } from "./controller";

async function start() {
    const app = await ExpressFactory
        .useModules([{
            name: "hello",
            dependencies: [ExpressModule],
            configure: ({ config }: IModuleConfigurator) => {
                const app = config.get(IExpressConfiguration);

                app.use(express.static(path.join(__dirname, "public")));
                app.use(useController(Controller));
            }
        }])
        .create();

    app.set("port", process.env.PORT || 3000);
    app.listen(app.get("port"), () => {
        console.log("  App started at http://localhost:%d", app.get("port"));
        console.log("  App running");
        console.log("  Press CTRL-C to stop\n");
    });           
}

start();