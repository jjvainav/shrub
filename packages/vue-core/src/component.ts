type Constructor<T> = { new(...args: any[]): T };

export interface IComponent {
    readonly id: string;
    readonly ctor: Constructor<any>;
}

export interface IComponentCollection<TComponent extends IComponent = IComponent> {
    getComponent(id: string): TComponent | undefined;
    getComponents(): TComponent[];
    hasComponents(): boolean;
    register(component: TComponent): void;
}

export class ComponentCollection<TComponent extends IComponent = IComponent> implements IComponentCollection<TComponent> {
    private readonly components = new Map<string, TComponent>();

    constructor(readonly id: string) {
    }

    getComponent(id: string): TComponent | undefined {
        return this.components.get(id);
    }

    getComponents(): TComponent[] {
        return Array.from(this.components.values());
    }

    hasComponents(): boolean {
        return this.components.size > 0;
    }

    register(component: TComponent): void {
        this.components.set(component.id, component);
    }
}