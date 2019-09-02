import { JSONSerializer } from "@shrub/serialization";
import { Singleton } from "@shrub/service-collection";
import { ModelConstructor, ModelService } from "@shrub/vue-core";

@Singleton
export class BrowserModelService extends ModelService {
    // TODO: create an options object to define the window property name containing the initial state and then load from constructor
    private readonly initialState = window && (<any>window).__INITIAL_STATE__;

    get<T>(key: string, ctor: ModelConstructor<T>): T {
        // check if a model already exists
        if (this.models[key]) {
            return this.models[key];
        }

        // if the model has not been initialized check the global initial state to see if data for the model exists
        if (this.initialState && this.initialState[key]) {
            const model = new JSONSerializer().deserialize<T>(this.initialState[key], ctor);
            this.models[key] = model;
        }

        // the base service will initialize a new instance of the model
        return super.get(key, ctor);
    }
}