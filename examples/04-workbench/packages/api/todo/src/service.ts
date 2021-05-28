import { createService, Singleton } from "@shrub/core";
import { ISocketIOServer } from "@shrub/socket.io";
import { ITodoItem, ITodoRepository } from "./repository";

export const ITodoService = createService<ITodoService>("todo-service");

export interface ITodoService {
    getItems(): Promise<ITodoItem[]>;
    listen(): void;
}

@Singleton
export class TodoService implements ITodoService {
    constructor(
        @ITodoRepository private readonly repository: ITodoRepository,
        @ISocketIOServer private readonly io: ISocketIOServer) {
    }

    getItems(): Promise<ITodoItem[]> {
        return this.repository.getItems();
    }

    listen(): void {
        const self = this;
        const io = this.io;

        io.on("connection", socket => {
            socket.on("items.save", function (data) {
                console.log("items.save", data);
                self.repository.saveItems(data).then(() => io.emit("items.save", data));
            });
            socket.on("items.delete", function (data) {
                console.log("items.delete", data);
                self.repository.deleteItems(data).then(() => io.emit("items.delete", data));
            });
        });
    }
}