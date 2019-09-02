import { JSONSerializer } from "@shrub/serialization";
import { createService, Singleton } from "@shrub/service-collection";

export const IModelService = createService<IModelService>("model-service");

export type ModelConstructor<T> = { new(): T };

/** Manages vue component model instances. */
export interface IModelService {
    get<T>(key: string, ctor: ModelConstructor<T>): T;
    set(key: string, model: object): void;
}

@Singleton
export class ModelService implements IModelService {
    readonly models: { [key: string]: any } = {};

    get<T>(key: string, ctor: ModelConstructor<T>): T {
        let model = this.models[key];
        if (model) {
            if (model.constructor !== ctor) {
                if (model.constructor !== Object.prototype.constructor) {
                    throw new Error("Model constructor mismatch");
                }

                // handle if the registered model is a POJO; attempt to deserialize as the specified model type
                model = new JSONSerializer().deserialize<T>(model, ctor);
                this.models[key] = model;
            }

            return model;
        }

        model = new ctor();
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