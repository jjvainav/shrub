import { HelloModule } from "@app/hello";
import { ModuleLoader } from "@shrub/core";

ModuleLoader.load({ modules: [HelloModule] });