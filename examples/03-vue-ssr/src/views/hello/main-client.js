import { ModuleLoader } from "@shrub/core";
import HelloModule from "./module";

ModuleLoader.load({
    modules: [HelloModule]
});