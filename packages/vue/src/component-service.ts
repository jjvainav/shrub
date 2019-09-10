import { createService, Singleton } from "@shrub/core";
import { ComponentCollection, IComponent, IComponentCollection } from "./component";

export const IComponentService = createService<IComponentService>("component-service");

/** A service that manages a collection of components. */
export interface IComponentService {
    getCollection<TComponent extends IComponent = IComponent>(id: string): IComponentCollection<TComponent>;
}

@Singleton
export class ComponentService implements IComponentService {
    private readonly collections = new Map<string, ComponentCollection>();

    getCollection<TComponent extends IComponent = IComponent>(id: string): IComponentCollection<TComponent> {
        let collection = this.collections.get(id);

        if (!collection) {
            collection = new ComponentCollection<TComponent>(id);
            this.collections.set(id, collection);
        }

        // TODO: is there anyway to verify/check the generic type?
        return <IComponentCollection<TComponent>>(<any>collection);
    }
}