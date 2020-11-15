import { IModule, IModuleConfigurator } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import World from "./world.vue";

export class WorldModule implements IModule {
    readonly name = "world";
    readonly dependencies = [VueModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IVueConfiguration).mount(World);
    }
}