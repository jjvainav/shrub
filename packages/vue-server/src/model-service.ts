import { Scoped } from "@shrub/core";
import { ModelService } from "@shrub/model";
import { JSONSerializer } from "@sprig/serialization";

@Scoped
export class ServerModelService extends ModelService {
    get hasModels(): boolean {
        for (const key of Object.keys(this.models)) {
            // make sure the property has an actual object and not just undefined/null
            if (this.models[key]) {
                return true;
            }
        }

        return false;
    }

    serialize(): any {
        return new JSONSerializer().serialize(this.models);
    }
}