import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { ExpressMessagingEventStreamModule } from "@shrub/express-messaging-event-stream";
import * as express from "express";
import * as path from "path";
import { Controller } from "./controller";

async function start() {
    const app = await ExpressFactory
        .useModules([{
            name: "producer",
            dependencies: [
                ExpressModule,
                ExpressMessagingEventStreamModule
            ],
            configure: ({ config }: IModuleConfigurator) => {
                const app = config.get(IExpressConfiguration);
                
                app.use(express.json());
                app.use(useController(Controller));

                app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
                app.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));
            }
        }])
        .create();

    app.set("port", process.env.PORT || 3000);
    app.listen(app.get("port"), () => {
        console.log("  Producer started at http://localhost:%d", app.get("port"));
        console.log("  Producer running");
        console.log("  Press CTRL-C to stop\n");
    });           
}

start();