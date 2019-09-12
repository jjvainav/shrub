import { NextFunction, Request, Response } from "express";
import { Route, Get } from "@shrub/express";
import { ITodoService } from "./service";

@Route()
export class TodoController {
    constructor(@ITodoService private readonly service: ITodoService) {
    }

    @Get()
    getItems(req: Request, res: Response, next: NextFunction): void {
        this.service.getItems()
            .then(result => res.json(result))
            .catch(next);
    }
}