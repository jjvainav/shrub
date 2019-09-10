import { createService, IInstantiationService, Singleton } from "@shrub/core";
import { JSONSerializer } from "@sprig/serialization";

export const IModelService = createService<IModelService>("model-service");

/** Defines a model constructor which supports service injection. */
export type ModelConstructor<T> = { new(...args: any[]): T };

/** Manages vue component model instances. */
export interface IModelService {
    get<T>(key: string, ctor: ModelConstructor<T>): T;
    set(key: string, model: object): void;
}

@Singleton
export class ModelService implements IModelService {
    // TODO: create an options object to define the window property name containing the initial state
    /** Used for data injection and will be used when initializing a new model object. */
    private readonly initialState = typeof window !== "undefined" && (<any>window).__INITIAL_STATE__;

    readonly models: { [key: string]: any } = {};

    constructor(@IInstantiationService private readonly instantiation: IInstantiationService) {
    }

    get<T>(key: string, ctor: ModelConstructor<T>): T {
        let model = this.models[key];

        if (!model && this.initialState) {
            // check if there is initial state for the model; if so, it will get deserialized into the model class below
            model = this.initialState && this.initialState[key];
        }

        if (model) {
            // check if the cached model's constructor matches the constructor passed in
            if (model.constructor !== ctor) {
                // if not check if the registered model is a POJO
                if (model.constructor !== Object.prototype.constructor) {
                    // if the model is not a POJO then there is a type mismatch 
                    throw new TypeError(`Model constructor (${model.constructor.name}) mismatch (${ctor.name})`);
                }

                // deserialize the POJO as the specified model type using the instantiation service for constructor injection support
                const serializer = new JSONSerializer({
                    factory: ctor => this.instantiation.createInstance(ctor)
                });
                model = serializer.deserialize<T>(model, ctor);
                this.models[key] = model;
            }

            return model;
        }

        model = this.instantiation.createInstance(ctor);
        this.models[key] = model;

        return model;
    }
    
    set(key: string, model: object): void {
        if (!model) {
            throw new Error("Model not defined");
        }

        this.models[key] = model;
    }
}