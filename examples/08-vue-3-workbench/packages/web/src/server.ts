import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressApplication } from "@shrub/express";
import { IHttpServer } from "@shrub/http";
import appFactory from "./app";

async function start() {
    const root = await ExpressFactory
        .useModules([{
            name: "example-workbench-root",
            dependencies: [ExpressModule],
            configure: async ({ services }: IModuleConfigurator) => {
                const server = services.get(IHttpServer);
                const app = services.get(IExpressApplication);

                app.set("port", process.env.PORT || 3000);

                // for sub-apps set the root server instance for modules that rely on it
                const createSubApp = (factory: ExpressFactory) => factory
                    .configureServices(registration => registration.registerInstance(IHttpServer, server))
                    .create();

                app.use("/", await createSubApp(appFactory));             
            }
        }])
        .create();

    root.listen(root.get("port"), () => {
        console.log("  Examples Vue 3 Workbench started at http://localhost:%d in %s mode", root.get("port"));
        console.log("  Vue 3 Workbench running");
        console.log("  Press CTRL-C to stop\n");;
    });
}

start();