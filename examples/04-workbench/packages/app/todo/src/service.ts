import axios from "axios";
import io, { Socket } from "socket.io-client";
import { createService, Singleton } from "@shrub/core";
import { EventEmitter, IEvent } from "@sprig/event-emitter";
import { ITodoItem } from "./item";

export const ITodoService = createService<ITodoService>("todo-service");

export interface ITodoService {
    readonly onItemDeleted: IEvent<string>;
    readonly onItemSaved: IEvent<ITodoItem>;

    getItems(): Promise<ITodoItem[]>;
    deleteItems(items: ITodoItem[]): void;
    saveItem(item: ITodoItem): void;
}

@Singleton
export class TodoService implements ITodoService {
    private readonly itemDeleted = new EventEmitter<string>("item-deleted");
    private readonly itemSaved = new EventEmitter<ITodoItem>("item-saved");
    private readonly socket: Socket;

    constructor() {
        this.socket = io({ transports: ["websocket"] });

        const self = this;
        this.socket.on("items.save", function (data: any) {
            const items: ITodoItem[] = data;
            items.forEach(item => self.itemSaved.emit(item));
        });

        this.socket.on("items.delete", function (data: any) {
            const ids: string[] = data;
            ids.forEach(id => self.itemDeleted.emit(id));
        });
    }

    get onItemDeleted(): IEvent<string> {
        return this.itemDeleted.event;
    }

    get onItemSaved(): IEvent<ITodoItem> {
        return this.itemSaved.event;
    }

    getItems(): Promise<ITodoItem[]> {
        return axios.get("/api/todos").then(response => {
            if (response.status !== 200) {
                throw new Error(`Invalid response (${response.status}) from server.`);
            }

            return response.data;
        });
    }

    deleteItems(items: ITodoItem[]): void {
        this.socket.emit("items.delete", items.map(item => item.id));
    }

    saveItem(item: ITodoItem): void {
        this.socket.emit("items.save", [item]);
    }
}