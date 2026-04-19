import { RequestHandler, Response } from "express";
import Type from "typebox";
import { TLocalizedValidationError } from "typebox/error";
import Schema from "typebox/schema";

declare module "@shrub/express/dist/request-context" {
    interface IRequestContext {
        schema?: ITypeboxSchema;
    }
}

interface ITypeboxSchema {
    parse<const Schema extends Schema.XSchema>(schema: Schema, value: unknown): Type.Static<Schema>;
    parse<const Schema extends Schema.XSchema>(context: Record<PropertyKey, Schema.XSchema>, schema: Schema, value: unknown): Type.Static<Schema>;
    tryParse<const Schema extends Schema.XSchema>(schema: Schema, value: unknown): Type.Static<Schema> | undefined;
    tryParse<const Schema extends Schema.XSchema>(context: Record<PropertyKey, Schema.XSchema>, schema: Schema, value: unknown): Type.Static<Schema> | undefined;
}

function match<Result>(args: unknown[], match: Record<number, (...args: unknown[]) => unknown>): Result {
    return (match[args.length]?.(...args) ?? (() => { throw Error("Invalid Arguments") })()) as never;
}

export function sendErrors(res: Response, errors: TLocalizedValidationError[]): void {
    res.status(400).json({ message: errors.map(issue => issue.instancePath ? `${issue.instancePath}/ - ${issue.message}` : issue.message).join("/n") });
}

/** Request typebox middleware that will expose functions for working with typebox. */
export const typeboxMiddleware = (): RequestHandler => {
    return (req, res, next) => {
        const schema: ITypeboxSchema = {
            parse: (...args: unknown[]) => Schema.Parse(...args as Parameters<typeof Schema.Parse>),
            tryParse: (...args: unknown[]) => {
                const [context, schema, value] = match<[Record<PropertyKey, Schema.XSchema>, Schema.XSchema, unknown]>(args, {
                    3: (context, schema, value) => [context, schema, value],
                    2: (schema, value) => [{}, schema, value]
                });

                if (!Schema.Check(context, schema, value)) {
                    const [_result, errors] = Schema.Errors(context, schema, value);
                    sendErrors(res, errors);
                }

                return value;
            }
        };

        req.context.schema = schema;
        next();
    };
};