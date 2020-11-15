import { IModule, IModuleConfigurator } from "@shrub/core";
import { IVueConfiguration, VueModule } from "@shrub/vue-3";
import Hello from "./hello.vue";

export class HelloModule implements IModule {
    readonly name = "hello";
    readonly dependencies = [VueModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IVueConfiguration).mount(Hello);
    }
}