import { TodoApiModule } from "@api/todo";
import { createExpressHostBuilder } from "@shrub/express";

export default createExpressHostBuilder()
    .useModules([TodoApiModule])
    .build();