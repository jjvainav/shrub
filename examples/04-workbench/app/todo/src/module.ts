import Vue from "vue";
import { IWorkbenchConfiguration, WorkbenchModule } from "@app/workbench";
import { IModule, IModuleConfigurator, IServiceRegistration } from "@shrub/core";
import { IModelService, ModelModule } from "@shrub/model";
import { TodoModel } from "./model";
import { ITodoService, TodoService } from "./service";

export class TodoModule implements IModule {
    readonly name = "todo";
    readonly dependencies = [
        ModelModule, 
        WorkbenchModule
    ];

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITodoService, TodoService);
    }

    configure({ config, services }: IModuleConfigurator): void {
        config.get(IWorkbenchConfiguration).registerExample({
            name: "todo",
            title: context => context.translate("todo.example.title"),
            locale: locale => import(/* webpackChunkName: "todo.locale.[request]" */ `./locale/example/${locale}`),
            props: () => ({
                model: Vue.observable(services.get(IModelService).get("todo", TodoModel))
            }),
            content: {
                component: () => import(/* webpackChunkName: "todo" */ "./component"),
                locale: locale => import(/* webpackChunkName: "todo.content.locale.[request]" */ `./locale/content/${locale}`)
            },
            menu: {
                order: 1,
                title: context => context.translate("todo.example.title"),
            }
        });
    }
}