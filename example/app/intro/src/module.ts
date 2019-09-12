import { IWorkbenchConfiguration, WorkbenchModule } from "@app/workbench";
import { IModule, IModuleConfigurator } from "@shrub/core";

export class IntroModule implements IModule {
    readonly name = "intro";
    readonly dependencies = [WorkbenchModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IWorkbenchConfiguration).registerExample({
            name: "intro",
            title: "Intro",
            component: () => import(/* webpackChunkName: "intro" */ "./component"),
            menu: {
                order: 1,
                title: "Intro"
            }
        });
    }    
}