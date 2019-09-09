import * as cors from "cors";
import * as express from "express";
import * as path from "path";
import { createExpressHostBuilder, ExpressModule, IExpressConfiguration } from "@shrub/express";
import { IModuleConfigurator } from "@shrub/module";
import { createRoutes } from "./routes";

const app = express();
app.set("port", process.env.PORT || 3001);

const host = createExpressHostBuilder({ app })
    .useModules([{
        name: "example-csr",
        dependencies: [ExpressModule],
        configure: ({ config }: IModuleConfigurator) => {
            const app = config.get(IExpressConfiguration);

            app.set("views", path.resolve(__dirname, "views"));

            app.use(cors());
            app.use(createRoutes());
        }
    }])
    .build();

const loading = host.load();
const server = host.app.listen(host.app.get("port"), () => {
    console.log("  Examples web-csr app started at http://localhost:%d in %s mode", host.app.get("port"));
    loading.then(() => {
        console.log("  Web-csr app running");
        console.log("  Press CTRL-C to stop\n");
    });
});
    
export default server;