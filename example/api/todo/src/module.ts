import { IModule, IModuleConfigurator, IServiceRegistration } from "@shrub/core";
import { ExpressModule, IExpressConfiguration, useController } from "@shrub/express";
import { SocketIOModule } from "@shrub/socket.io";
import { TodoController } from "./controller";
import { ITodoRepository, TodoRepository } from "./repository";
import { ITodoService, TodoService } from "./service";

export class TodoApiModule implements IModule {
    readonly name = "todo-api";
    readonly dependencies = [
        ExpressModule,
        SocketIOModule
    ];

    configureServices(registration: IServiceRegistration): void {
        registration.register(ITodoRepository, TodoRepository);
        registration.register(ITodoService, TodoService);
    }

    configure({ config, services }: IModuleConfigurator): void {
        const express = config.get(IExpressConfiguration);
        express.use("/todos", useController(TodoController));

        services.get(ITodoService).listen();
    }
}