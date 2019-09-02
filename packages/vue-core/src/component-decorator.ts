import Vue, { ComponentOptions, VueConstructor } from "vue";
import Component from "vue-class-component";
import { IServiceCollection } from "@shrub/service-collection";
import { IComponentCollection } from "./component";
import { IComponentService } from "./component-service";

/** Decorator extension for Vue components with added support for features such as dynamic components registered to a Vue component collection. */
export function VueComponent<V extends Vue>(options: ComponentOptions<V> & ThisType<V> & { collection?: string | ((services: IServiceCollection) => IComponentCollection) }) {
    if (options.collection) {
        const collection = options.collection;
        const beforeCreate = options.beforeCreate;

        options.beforeCreate = function () {
            if (beforeCreate) {
                beforeCreate.call(this);
            }

            const components = typeof collection === "string"
                ? this.$services.get(IComponentService).getCollection(collection).getComponents()
                : collection(this.$services).getComponents();

            for (const component of components) {
                this.$options.components![component.id] = <VueConstructor>component.ctor;
            }
        };
    }

    return Component(options);
}