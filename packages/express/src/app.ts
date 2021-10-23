import { createService } from "@shrub/core";
import { Application } from "express";

export const IExpressApplication = createService<IExpressApplication>("express-application");
export interface IExpressApplication extends Application {
}