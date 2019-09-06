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

        // set the model to the initial state (if one exists) and let the base model deserialize it based on the provided constructor
        this.models[key] = this.initialState && this.initialState[key];
        return super.get(key, ctor);
    }
}