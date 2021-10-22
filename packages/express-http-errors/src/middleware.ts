import { NextFunction, Request, Response } from "express";
import { HttpError } from "http-errors";

/** Express middleware installed by the module. */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (!isHttpError(err)) {
        return next(err);
    }

    if (!res.headersSent) {
        if (err.headers) {
            for (const key of Object.keys(err.headers)) {
                if (err.headers[key]) {
                    res.setHeader(key, err.headers[key]);
                }
            }
        }

        res.status(err.status).json({
            error: err.name,
            message: err.expose ? err.message : undefined
        });
    }
}

function isHttpError(err: Error): err is HttpError {
    return (<HttpError>err).status !== undefined && (<HttpError>err).statusCode !== undefined;
}