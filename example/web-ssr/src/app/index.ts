import * as cors from "cors";
import * as path from "path";
import { IModuleConfigurator } from "@shrub/core";
import { createExpressHostBuilder, ExpressModule, IExpressConfiguration } from "@shrub/express";
import { createRoutes } from "./routes";

export default createExpressHostBuilder()
    .useModules([{
        name: "example-ssr",
        dependencies: [ExpressModule],
        configure: ({ config }: IModuleConfigurator) => {
            const app = config.get(IExpressConfiguration);

            app.set("views", path.resolve(__dirname, "views"));

            app.use(cors());
            app.use(createRoutes());
        }
    }])
    .build();