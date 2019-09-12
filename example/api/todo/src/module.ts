import { IModule, IModuleConfigurator, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { TodoController } from "./controller";
import { ITodoRepository, TodoRepository } from "./repository";
import { ITodoService, TodoService } from "./service";

export class TodoApiModule implements IModule {
    readonly name = "todo-api";
    readonly dependencies = [ExpressModule];

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITodoRepository, TodoRepository);
        registration.register(ITodoService, TodoService);
    }

    configure({ config }: IModuleConfigurator): void {
        const express = config.get(IExpressConfiguration);
        express.use("/todo", useController(TodoController));
    }
}