import { ModuleLoader } from "@shrub/core";
import { AppModule } from "./module";

ModuleLoader
    .useSettings({ vue: { ssr: true } })
    .useModules([AppModule])
    .load();