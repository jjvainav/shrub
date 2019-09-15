import { createService, Singleton } from "@shrub/core";

export const ITodoRepository = createService<ITodoRepository>("todo-repository");

export interface ITodoRepository {
    getItems(): Promise<ITodoItem[]>;
    deleteItems(ids: string[]): Promise<void>;
    saveItems(items: ITodoItem[]): Promise<void>;
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

    deleteItems(ids: string[]): Promise<void> {
        ids.forEach(id => this.items.delete(id));
        return Promise.resolve();
    }

    saveItems(items: ITodoItem[]): Promise<void> {
        items.forEach(item => this.items.set(item.id, item));
        return Promise.resolve();
    }
}