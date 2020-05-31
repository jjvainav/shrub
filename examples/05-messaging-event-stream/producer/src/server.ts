import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { ExpressMessagingEventStreamModule } from "@shrub/express-messaging-event-stream";
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