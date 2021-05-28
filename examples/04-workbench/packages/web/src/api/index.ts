import { TodoApiModule } from "@api/todo";
import { ExpressFactory } from "@shrub/express";

export default ExpressFactory.useModules([TodoApiModule]);