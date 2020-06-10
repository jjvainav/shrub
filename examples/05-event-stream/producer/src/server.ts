import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { ExpressEventStreamModule, IExpressEventStreamConfiguration } from "@shrub/express-event-stream";
import { ExpressTracingModule, useRequestTracing } from "@shrub/express-tracing";
import { TracingConsoleModule } from "@shrub/tracing-console";
import * as express from "express";
import * as path from "path";
import { Controller } from "./controller";

async function start() {
    const app = await ExpressFactory
        .useModules([{
            name: "producer",
            dependencies: [
                ExpressModule,
                ExpressEventStreamModule,
                ExpressTracingModule,
                TracingConsoleModule
            ],
            configure: ({ config }: IModuleConfigurator) => {
                config.get(IExpressEventStreamConfiguration).useProducer();

                const app = config.get(IExpressConfiguration);

                app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
                app.get(/\/public(.*)/, express.static(__dirname, { fallthrough: false }));

                app.use(express.json());
                app.use(useRequestTracing());
                app.use(useController(Controller));
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