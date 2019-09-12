import { createService, Singleton } from "@shrub/core";

export const ITodoRepository = createService<ITodoRepository>("todo-repository");

export interface ITodoRepository {
    getItems(): Promise<ITodoItem[]>;
    saveItem(item: ITodoItem): Promise<void>;
}

export interface ITodoItem {
    readonly id: string;
    title: string;
    completed: boolean;
}

@Singleton
export class TodoRepository implements ITodoRepository {
    private readonly items = new Map<string, ITodoItem>();

    getItems(): Promise<ITodoItem[]> {
        return Promise.resolve(Array.from(this.items.values()));
    }

    saveItem(item: ITodoItem): Promise<void> {
        this.items.set(item.id, item);
        return Promise.resolve();
    }
}