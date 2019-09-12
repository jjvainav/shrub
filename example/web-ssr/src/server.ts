import * as express from "express";
import apiHost from "./api";
import appHost from "./app";

const root = express();
root.set("port", process.env.PORT || 3000);

root.use("/api", apiHost.app);
root.use("/", appHost.app);

const loading = Promise.all([
    apiHost.load(),
    appHost.load()
]);

const server = root.listen(root.get("port"), () => {
    console.log("  Examples web-ssr app started at http://localhost:%d in %s mode", root.get("port"));
    loading.then(() => {
        console.log("  Web-ssr app running");
        console.log("  Press CTRL-C to stop\n");
    });
});
    
export default server;