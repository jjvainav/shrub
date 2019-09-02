import { JSONSerializer } from "@shrub/serialization";
import { Singleton } from "@shrub/service-collection";
import { ModelService } from "@shrub/vue-core";

@Singleton
export class ServerModelService extends ModelService {
    get hasModels(): boolean {
        return Object.keys(this.models).length > 0;
    }

    serialize(): any {
        return new JSONSerializer().serialize(this.models);
    }
}