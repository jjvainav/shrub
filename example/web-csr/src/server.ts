import { IModuleConfigurator } from "@shrub/core";
import { ExpressFactory, ExpressModule, IExpressApplication } from "@shrub/express";
import { IHttpServer } from "@shrub/http";
import apiFactory from "./api";
import appFactory from "./app";

async function start() {
    const root = await ExpressFactory
        .useModules([{
            name: "example-csr-root",
            dependencies: [ExpressModule],
            configure: async ({ services }: IModuleConfigurator) => {
                const server = services.get(IHttpServer);
                const app = services.get(IExpressApplication);

                app.set("port", process.env.PORT || 3001);

                // for sub-apps set the root server instance for modules that rely on it
                const createSubApp = (factory: ExpressFactory) => factory
                    .configureServices(registration => registration.registerInstance(IHttpServer, server))
                    .create();

                app.use("/api", await createSubApp(apiFactory));
                app.use("/", await createSubApp(appFactory));             
            }
        }])
        .create();

    root.listen(root.get("port"), () => {
        console.log("  Examples web-csr app started at http://localhost:%d in %s mode", root.get("port"));
        console.log("  Web-csr app running");
        console.log("  Press CTRL-C to stop\n");;
    });
}

start();