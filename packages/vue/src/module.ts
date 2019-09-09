import Vue, { ComponentOptions, VueConstructor, VNodeData } from "vue";
import { createConfigType, IModule, IModuleConfigurator, IModuleInitializer } from "@shrub/module";
import { IServiceCollection, IServiceRegistration } from "@shrub/service-collection";
import { ComponentService, IComponentService } from "./component-service";
import { IModelService, ModelService } from "./model-service";

declare module "vue/types/vue" {
    interface Vue {
        /** Utility for assigning or acquiring a unique identifier that is useful for use with v-for. */
        readonly $key: IVueKeyProvider;
        /** Provides access to the global services container. */
        readonly $services: IServiceCollection;
    }
}

declare module "vue/types/options" {
    interface ComponentOptions<
        V extends Vue,
        Data,
        Methods,
        Computed,
        PropsDef,
        Props> {
        services?: IServiceCollection;
    }
}

Vue.use({
    install(vue: typeof Vue) {
        if (!vue.prototype.$key) {
            Object.defineProperty(vue.prototype, "$key", { value: createValueKeyProvider() });
            Vue.mixin({
                beforeCreate: function() {
                    if (this.$options.services) {
                        (<any>this).$services = this.$options.services;
                    }
                    else if (this.$options.parent && this.$options.parent.$services) {
                        (<any>this).$services = this.$options.parent.$services;
                    }
                }
            });
        }
    }
});

export const IVueConfiguration = createConfigType<IVueConfiguration>("vue");
export interface IVueConfiguration {
    /** Mounts the specified Vue component. */
    mount(component: VueConstructor, options?: IVueMountOptions): void;
}

export interface IVueModuleSettings {
    /** The element id to mount to; the default is #app. */
    readonly el?: string;
}

export interface IVueMountOptions {
    /** Component options passed to the root Vue component hosting the mounted component. */
    readonly options?: ComponentOptions<Vue> | (() => ComponentOptions<Vue>);
    /** VNodeData passed to the mounted component instance. */
    readonly data?: VNodeData | (() => VNodeData);
}

/** 
 * In some situations Vue requires a key when using v-for (https://vuejs.org/v2/guide/list.html#v-for-with-a-Component) and is highly-recommended elsewhere.
 * This provider is useful for objects that don't have a unique identifier, invoking it will assign and return a unique identifier for the object; if one 
 * had been previously assigned that value will be returned.
 * 
 * Note: this is really only necessary if the list of items is modified (e.g. re-ordered or added/removed); otherwise using the item index maybe good enough.
 */
export interface IVueKeyProvider {
    (obj?: object): number;
}

// a basic interface for interacting with Vue router which avoids the need to import the vue-router package
interface IVueRouter {
    onReady(cb: Function): void;
}

function createValueKeyProvider() {
    let nextId = 1;
    return (obj?: object) => {
        if (obj === undefined) {
            return -1;
        }

        if (Array.isArray(obj)) {
            throw new Error("Invalid object");
        }

        if (!(<any>obj).__id__) {
            // make sure the property is not configurable/enumerable so that it doesn't get overridden, copied if being cloned, or enumerable
            Object.defineProperty(obj, "__id__", { value: nextId++ });
        }
    
        return (<any>obj).__id__;
    };
}

export class VueModule implements IModule {
    readonly name = "vue";
    readonly dependencies = [];   

    initialize({ config }: IModuleInitializer): void {
        config(IVueConfiguration).register(({ settings, services }: IModuleConfigurator) => ({
            mount: (component, options) => {
                const el = this.getElementId(settings);
                if (!document.getElementById(el.substr(1))) {
                    throw new Error(`Element with id (${el}) not found`);
                }

                const componentOptions = this.getComponentOptions(options);
                const router = <IVueRouter>(<any>componentOptions).router;
                const app = new Vue({
                    services,
                    render: h => h(component, this.getData(options)),
                    ...componentOptions
                });

                if (router) {
                    router.onReady(() =>  app.$mount(el));
                }
                else {
                    app.$mount(el);
                }
            }
        }));
    }

    configureServices(registration: IServiceRegistration): void {
        registration.register(IComponentService, ComponentService);
        registration.register(IModelService, ModelService);
    }

    private getElementId(settings: IVueModuleSettings): string {
        if (settings.el) {
            // Vue expects the element id to be prefixed with a '#'
            return settings.el[0] === "#" ? settings.el : "#" + settings.el;
        }

        return "#app";
    }

    private getComponentOptions(mountOptions?: IVueMountOptions): ComponentOptions<Vue> {
        if (mountOptions && mountOptions.options) {
            return typeof mountOptions.options === "function" 
                ? mountOptions.options()
                : mountOptions.options;
        }

        return {};
    }

    private getData(mountOptions?: IVueMountOptions): VNodeData | undefined {
        if (mountOptions && mountOptions.data) {
            return typeof mountOptions.data === "function" 
                ? mountOptions.data()
                : mountOptions.data;
        }

        return undefined;
    }
}