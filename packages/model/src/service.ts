import { createOptions, createService, IInstantiationService, Singleton } from "@shrub/core";
import { JSONSerializer } from "@sprig/serialization";

export const IModelService = createService<IModelService>("model-service");
export const IModelServiceOptions = createOptions<IModelServiceOptions>("model-service-options", {
    globalVariableName: "__INITIAL_STATE__"
});

/** Defines a model constructor which supports service injection. */
export type ModelConstructor<T> = { new(...args: any[]): T };

/** Defines options for the model service. */
export interface IModelServiceOptions {
    /** The name of the global variable containing the initial state used to load models from. */
    readonly globalVariableName: string;
}

/** Defines a factory for creating models from an optionally defined initial state. */
export interface IModelFactory<T> {
    create(state: any): T;
}

/** Defines a factory for creating models asynchronously from an optionally defined initial state. */
export interface IAsyncModelFactory<T> {
    create(state: any): Promise<T>;
}

/** Manages vue component model instances. */
export interface IModelService {
    get<T>(key: string, ctor: ModelConstructor<T>): T;
    get<T>(key: string, factory: IModelFactory<T>): T;
    get<T>(key: string, ctorOrFactory: ModelConstructor<T> | IModelFactory<T>): T;
    getAsync<T>(key: string, factory: IAsyncModelFactory<T>): Promise<T>;
    set(key: string, model: object): void;
}

@Singleton
export class ModelService implements IModelService {
    /** Used for data injection and will be used when initializing a new model object. */
    private readonly initialState?: any;

    readonly models: { [key: string]: any } = {};

    constructor(
        @IModelServiceOptions private readonly options: IModelServiceOptions,
        @IInstantiationService private readonly instantiation: IInstantiationService) {
        if (typeof window !== "undefined") {
            this.initialState = (<any>window)[this.options.globalVariableName];
        }
    }

    get<T>(key: string, ctor: ModelConstructor<T>): T;
    get<T>(key: string, factory: IModelFactory<T>): T;
    get<T>(key: string, ctorOrFactory: ModelConstructor<T> | IModelFactory<T>): T {
        if (this.models[key]) {
            return this.models[key];
        }

        const state = this.initialState && this.initialState[key];

        // note: a factory object is used instead of a factory method due to lack of ability to determine a factory method from a constructor
        if (this.isFactory(ctorOrFactory)) {
            this.models[key] = ctorOrFactory.create(state);
            return this.models[key];
        }

        if (!state) {
            this.models[key] = this.instantiation.createInstance(ctorOrFactory);
            return this.models[key];
        }

        // deserialize the state as the specified model type using the instantiation service for constructor injection support
        const serializer = new JSONSerializer({
            factory: ctor => this.instantiation.createInstance(ctor)
        });
        this.models[key] = serializer.deserialize<T>(state, ctorOrFactory);
        return this.models[key];
    }

    getAsync<T>(key: string, factory: IAsyncModelFactory<T>): Promise<T> {
        if (this.models[key]) {
            return Promise.resolve(this.models[key]);
        }

        const state = this.initialState && this.initialState[key];
        return factory.create(state).then(model => {
            this.models[key] = model;
            return model;
        });
    }
    
    set(key: string, model: object): void {
        if (!model) {
            throw new Error("Model not defined");
        }

        this.models[key] = model;
    }

    private isFactory<T>(ctorOrFactory: ModelConstructor<T> | IModelFactory<T>): ctorOrFactory is IModelFactory<T> {
        return (<any>ctorOrFactory).create !== undefined;
    }
}