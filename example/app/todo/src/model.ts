export interface ITodoItem {
    readonly id: string;
    title: string;
    completed: boolean;
}

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

let id = 1;

export class TodoModel {
    private editState?: IEditState = undefined;

    filter = Filter.all;
    items: ITodoItem[] = [];

    constructor() {
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
            }

            this.editState = undefined;
        }
    }

    addTodo(title: string): void {
        this.items.push({
            id: (id++).toString(),
            title,
            completed: false
        });
    }

    removeTodo(item: ITodoItem): void {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
        }
    }

    removeCompleted(): void {
        this.items = filters.active(this.items);
    }
}