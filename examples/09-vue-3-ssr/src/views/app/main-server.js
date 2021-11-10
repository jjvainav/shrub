import { ModuleLoader } from "@shrub/core";
import { IVueAppService } from "@shrub/vue-3";
import { IVueRouterService } from "@shrub/vue-3-router";
import { AppModule } from "./module";

export default function () {
    return ModuleLoader
        .useSettings({ vue: { ssr: true, isServer: true } })
        .useModules([AppModule])
        .load()
        .then(collection => ({
            app: collection.services.get(IVueAppService).app,
            router: collection.services.get(IVueRouterService).router
        }));
}