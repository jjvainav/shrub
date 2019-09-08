import { IWorkbenchConfiguration, WorkbenchModule } from "@examples/workbench";
import { IModule, IModuleConfigurator } from "@shrub/module";

export class HelloWorldModule implements IModule {
    readonly name = "hello-world";
    readonly dependencies = [WorkbenchModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IWorkbenchConfiguration).registerExample({
            name: "01-hello-world",
            title: "Hello World!",
            component: () => import(/* webpackChunkName: "01-hello-world" */ "./components/hello-world"),
            menu: {
                order: 1,
                title: "01 - Hello World"
            }
        });
    }    
}