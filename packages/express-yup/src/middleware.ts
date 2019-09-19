import { NextFunction, Request, Response } from "express";
import yup from "yup";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (yup.ValidationError.isError(err)) {
        res.status(400).json({
            message: err.errors
        });
    }
    else {
        next(err);
    }
}