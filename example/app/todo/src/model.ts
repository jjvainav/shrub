import { ITodoItem } from "./item";
import { ITodoService } from "./service";

interface IEditState {
    readonly title: string;
    readonly item: ITodoItem;
}

export const enum Filter {
    all = "all",
    active = "active",
    completed = "completed"
}

const filters: { [key in Filter]: (items: ITodoItem[]) => ITodoItem[] } = {
    all: (items: ITodoItem[]) => items,
    active: (items: ITodoItem[]) => items.filter(item => !item.completed),
    completed: (items: ITodoItem[]) => items.filter(item => item.completed)
};

export class TodoModel {
    private editState?: IEditState = undefined;

    filter = Filter.all;
    items: ITodoItem[] = [];

    constructor(@ITodoService private readonly service: ITodoService) {
        service.getItems().then(result => this.items = result);
        service.onItemDeleted(id => this.deleteItem(id));
        service.onItemSaved(item => this.saveItem(item));

        if (typeof window !== "undefined") {
            window.addEventListener("hashchange", () => {
                const filter = <Filter>window.location.hash.replace(/#\/?/, "");
                if (filters[filter]) {
                    this.filter = filter;
                }
                else {
                    window.location.hash = "";
                    this.filter = Filter.all;
                }
            });
        }
    }

    get allCompleted(): boolean {
        return filters.active(this.items).length === 0;
    }

    set allCompleted(value: boolean) {
        this.items.forEach(item => item.completed = value);
    }

    activeItemCount(): number {
        return filters.active(this.items).length;
    }

    hasItems(): boolean {
        return this.items.length > 0;
    }

    isBeingEdited(item: ITodoItem): boolean {
        return this.editState !== undefined && item === this.editState.item;
    }

    getFilteredItems(): ITodoItem[] {
        return filters[this.filter](this.items);
    }

    setCompleted(item: ITodoItem, value: boolean): void {
        item.completed = value;
        this.service.saveItem(item);
    }

    beginEdit(item: ITodoItem): void {
        this.editState = { title: item.title, item };
    }

    cancelEdit(): void {
        if (this.editState) {
            this.editState.item.title = this.editState.title;
            this.editState = undefined;
        }
    }

    endEdit(): void {
        if (this.editState) {
            const item = this.editState.item;
            item.title = item.title.trim();

            if (!item.title) {
                this.removeTodo(item);
                this.service.deleteItems([item]);
            }
            else {
                this.service.saveItem(item);
            }

            this.editState = undefined;
        }
    }

    addTodo(title: string): void {
        const item: ITodoItem = {
            id: (Date.now()).toString(),
            title,
            completed: false
        };

        this.items.push(item);
        this.service.saveItem(item);
    }

    removeTodo(item: ITodoItem): void {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
            this.service.deleteItems([item]);
        }
    }

    removeCompleted(): void {
        const itemsToDelete: ITodoItem[] = [];
        const filteredItems: ITodoItem[] = [];

        for (const item of this.items) {
            if (item.completed) {
                itemsToDelete.push(item);
            }
            else {
                filteredItems.push(item);
            }
        }

        if (itemsToDelete.length) {
            this.items = filteredItems;
            this.service.deleteItems(itemsToDelete);
        }
    }

    private saveItem(item: ITodoItem): void {
        for (const cur of this.items) {
            if (cur.id === item.id) {
                cur.title = item.title;
                cur.completed = item.completed;
                return;
            }
        }

        // the item does not exist so add it
        this.items.push(item);
    }

    private deleteItem(id: string): void {
        this.items = this.items.filter(item => item.id !== id);
    }
}