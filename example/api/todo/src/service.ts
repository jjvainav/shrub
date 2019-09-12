import { createService, Transient } from "@shrub/core";
import { ITodoItem, ITodoRepository } from "./repository";

export const ITodoService = createService<ITodoService>("todo-service");

export interface ITodoService {
    getItems(): Promise<ITodoItem[]>;
}

@Transient
export class TodoService implements ITodoService {
    constructor(@ITodoRepository private readonly repository: ITodoRepository) {
    }

    getItems(): Promise<ITodoItem[]> {
        return this.repository.getItems();
    }
}