import * as express from "express";
import createApiServer from "./api";
import createAppServer from "./app";

async function start() {
    const root = express();
    root.set("port", process.env.PORT || 3001);
    
    const apiServer = await createApiServer();
    const appServer = await createAppServer();

    root.use("/api", apiServer.app);
    root.use("/", appServer.app);
    
    root.listen(root.get("port"), () => {
        console.log("  Examples web-csr app started at http://localhost:%d in %s mode", root.get("port"));
        console.log("  Web-csr app running");
        console.log("  Press CTRL-C to stop\n");;
    });
}

start();