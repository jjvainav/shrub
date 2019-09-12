import { IWorkbenchConfiguration, WorkbenchModule } from "@example/workbench";
import { IModule, IModuleConfigurator } from "@shrub/core";

export class TodoModule implements IModule {
    readonly name = "todo";
    readonly dependencies = [WorkbenchModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IWorkbenchConfiguration).registerExample({
            name: "todo",
            title: "Todo Example",
            component: () => import(/* webpackChunkName: "todo" */ "./component"),
            menu: {
                order: 1,
                title: "Todo"
            }
        });
    }    
}