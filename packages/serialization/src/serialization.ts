import { EventEmitter, IEvent } from "@shrub/event-emitter";

type Constructor<T> = { new(...args: any[]): T };
type PropertyNames<T> = { [K in keyof T]: K }[keyof T];
export type PropertyOptions<T> = { [P in PropertyNames<T>]?: SerializablePropertyOptions<NonNullable<T[P]>> };

export type JSONSerializerOptions = {
    readonly typeSerializer?: ITypeSerializer;
};

export type SerializableTypeInfo<T> = {
    readonly autoRegisterProperties?: boolean;
    readonly typeKey?: string;
    readonly typeName?: string | { (ctor: T): string }
};

export type SerializablePropertyOptions<T, T1 = T> = {
    /** Explicitly defines the property Type and is required for deserializing Objects that use the serializer decorators. */
    readonly type?: Constructor<T>;
    readonly name?: string;
    readonly as?: IValueSerializer<T, T1>;
};

type TypeInfoChangedEvent = {
    readonly type: SerializableType<any>;
    readonly oldTypeName: string;
};

export interface IJSONSerializerContext {
    readonly typeSerializer: ITypeSerializer;
}

export interface ITypeSerializer {
    serialize(context: IJSONSerializerContext, type: ISerializableType, obj: any): any;
    deserialize(context: IJSONSerializerContext, type: ISerializableType, json: any): any;
}

export interface IValueSerializer<TFrom, TTo> {
    serialize(context: IJSONSerializerContext, value: TFrom): TTo;
    deserialize(context: IJSONSerializerContext, value: TTo): TFrom;
}

export interface ISerializableType {
    readonly typeKey: string;
    readonly typeName: string;
    readonly ctor: Constructor<any>;
    readonly baseType?: ISerializableType;
    readonly serializer: IValueSerializer<any, any>;
}

export interface ISerializableProperty {
    readonly key: string;
    readonly name: string;
    readonly type?: ISerializableType;
    readonly serializer?: IValueSerializer<any, any>;
}

export const UnixTime: IValueSerializer<Date, number> = {
    serialize: (context, value) => epoch.fromDate(value),
    deserialize: (context, value) => epoch.toDate(value)
};

export const NumericString: IValueSerializer<Number, string> = {
    serialize: (context, value) => value.toString(),
    deserialize: (context, value) => parseInt(value)
};

const epoch = {
    fromDate: (date: Date) => Math.floor(date.getTime() / 1000),
    toDate: (timestamp: number) => new Date(timestamp * 1000)
};
const types = new Map<Function, SerializableType<any>>();

/** Flags a class as serializable and is useful for subclasses that don't explicitly define serializable properties or if a class needs to define explicit type information. */
export function Serializable<T extends Function>(typeInfo?: SerializableTypeInfo<T>) {
    return (ctor: any) => {
        if (!types.has(ctor)) {
            types.set(ctor, new SerializableType(ctor, typeInfo));
        }
        else if (typeInfo) {
            // class decorators get invoked after property decorators so update the type info
            types.get(ctor)!.setTypeInfo(typeInfo);
        }
    };
}

/** Flags a property as serializable for a serializable class. */
export function Serialize<T, T1 = T>(options?: SerializablePropertyOptions<T, T1>): (target: any, key: string) => void {
    return (target: any, key: string) => {
        if (typeof target !== "object") {
            throw new Error("Serialize can only be applied to instance properties");
        }

        const ctor = <Constructor<any>>(<Object>target).constructor;
        let type = types.get(ctor);

        if (!type) {
            type = new SerializableType(ctor);
            types.set(ctor, type);
        }

        type.setProperty(key, options);
    };
}

/** Allows properties for a type to be configured without the need for a Serialize decorator. */
export function configureType<T>(ctor: Constructor<T>, props: PropertyOptions<T>): void {
    getType(ctor).configure(props);
}

function getBaseType(ctor: Constructor<any>): SerializableType<any> | undefined {
    // TODO: it seems __proto__ is deprecated but still used by browsers: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto
    if (ctor.prototype.__proto__ && ctor.prototype.__proto__.constructor && ctor.prototype.__proto__.constructor !== Object) {
        return types.get(ctor.prototype.__proto__.constructor);
    }

    return undefined;
}

function getType<T>(ctor: Constructor<T>): SerializableType<T> {
    let type = types.get(ctor);

    if (!type) {
        // auto-register the type
        type = new SerializableType(ctor, { autoRegisterProperties: true });
        types.set(ctor, type);
    }

    return type;
}

function getTypeOrSubType(base: SerializableType<any>, json: any): SerializableType<any> {
    const typeName = json[base.typeKey];
    if (typeName !== undefined && typeName !== base.typeName) {
        // the type name is different, try to find a sub type and use that to deserialize the result
        return base.getSubType(typeName);
    }

    return base;
}

const defaultTypeSerializer = new class DefaultTypeSerializer implements ITypeSerializer {
    serialize(context: IJSONSerializerContext, type: ISerializableType, obj: any): any {
        return type.serializer.serialize(context, obj);
    }

    deserialize(context: IJSONSerializerContext, type: ISerializableType, json: any): any {
        return type.serializer.deserialize(context, json);
    }
};

const noOpValueSerializer: IValueSerializer<any, any> = {
    serialize: (context, value) => value,
    deserialize: (context, value) => value
};

/** 
 * Provides support serializing class objects to simple json objects. This is useful for
 * serializing complex class types into simple json objects. The serialization can be
 * controlled via the Serialize and Serializable decorators.
 */
export class JSONSerializer {
    private readonly typeSerializer: ITypeSerializer;
    private readonly context: IJSONSerializerContext;

    constructor(options?: JSONSerializerOptions) {
        this.typeSerializer = options && options.typeSerializer || defaultTypeSerializer;
        this.context = {
            typeSerializer: this.typeSerializer
        };
    }

    serialize(obj: object): any {
        if (obj === undefined) {
            throw new Error("obj not defined");
        }

        const ctor = <Constructor<any>>(<Object>obj).constructor;
        if (ctor === undefined) {
            throw new Error("obj does not have a constructor");
        }

        return this.typeSerializer.serialize(this.context, getType(ctor), obj);
    }

    deserialize(obj: any): object;
    deserialize<T>(obj: any, ctor: Constructor<T>): T;
    deserialize(obj: any, ctor?: Constructor<any>): any {
        if (!obj || typeof obj !== "object") {
            throw new Error("Invalid json object");
        }

        ctor = ctor || <Constructor<any>>Object.prototype.constructor;
        return this.typeSerializer.deserialize(this.context, getTypeOrSubType(getType(ctor), obj), obj);
    }
}

class ObjectSerializer<T> implements IValueSerializer<object, any> {
    constructor(private readonly type: SerializableType<T>) {
    }

    serialize(context: IJSONSerializerContext, obj: any): any {
        const json: any = {};

        if (this.type.shouldSerializeTypeInfo()) {
            json[this.type.typeKey] = this.type.typeName;
        }

        for (const entry of this.type.getProperties(obj)) {
            const name = entry[1].name;
            const value = obj[entry[0]];

            if (value === undefined) {
                continue;
            }

            if (Array.isArray(value)) {
                json[name] = this.processArray(context, value, entry[1], this.serializeValue, this.serializeObject);
                continue;
            }

            json[name] = this.processValue(context, value, entry[1], this.serializeValue, this.serializeObject);
        }

        return json;
    }

    deserialize(context: IJSONSerializerContext, json: any): any {
        const obj: any = new this.type.ctor();
        for (const entry of this.type.getProperties(json)) {
            const value = json[entry[1].name];

            if (value === undefined) {
                continue;
            }

            if (Array.isArray(value)) {
                obj[entry[0]] = this.processArray(context, value, entry[1], this.deserializeValue, this.deserializeObject);
                continue;
            }

            obj[entry[0]] = this.processValue(context, value, entry[1], this.deserializeValue, this.deserializeObject);
        }

        return obj;
    }
    
    private processArray(
        context: IJSONSerializerContext,
        values: any[],
        prop: ISerializableProperty,
        handleValue: (context: IJSONSerializerContext, value: any, serializer: IValueSerializer<any, any>) => any,
        handleObject: (context: IJSONSerializerContext, type: ISerializableType, value: any) => any): any[] {
        const array: any[] = [];
        values.forEach(item => array.push(this.processValue(context, item, prop, handleValue, handleObject)));
        return array;
    }

    private processValue(
        context: IJSONSerializerContext,
        value: any,
        prop: ISerializableProperty,
        handleValue: (context: IJSONSerializerContext, value: any, serializer: IValueSerializer<any, any>) => any,
        handleObject: (context: IJSONSerializerContext, type: ISerializableType, value: any) => any): any {
        // first check to see if there is a custom serializer on the property
        if (prop.serializer) {
            return handleValue(context, value, prop.serializer);
        }
        
        // Check if the value is a class and try to get the SerializableTypeInfo if it is. The type
        // explicitly set on the property is only used as a fallback; the reason is, the object
        // may be a subtype so its SerializableTypeInfo should be used instead of the base type.
        // Skip if the value is a JSON object.
        if (typeof value === "object" && (<Object>value).constructor !== Object.prototype.constructor) {
            const type = types.get((<Object>value).constructor);
            if (type) {
                return handleObject(context, type, value);
            }
        }

        // use the explicitly set type if one was defined
        if (prop.type) {
            return handleObject(context, prop.type, value);
        }

        return value;
    }

    private deserializeValue(context: IJSONSerializerContext, value: any, serializer: IValueSerializer<any, any>): any {
        return serializer.deserialize(context, value);
    }

    private deserializeObject(context: IJSONSerializerContext, type: ISerializableType, value: any): any {
        // when deserializing, the value will be a JSON object and the type gets determined based on the target property settings - the type defined in the settings may be a base type so check and grab the serializable type for the value if it is a sub type
        return context.typeSerializer.deserialize(context, getTypeOrSubType(<SerializableType<any>>type, value), value);
    }

    private serializeValue(context: IJSONSerializerContext, value: any, serializer: IValueSerializer<any, any>): any {
        return serializer.serialize(context, value);
    }

    private serializeObject(context: IJSONSerializerContext, type: ISerializableType, value: any): any {
        return context.typeSerializer.serialize(context, type, value);
    }
};

class SerializableType<T> implements ISerializableType  {
    private readonly typeInfoChanged = new EventEmitter<TypeInfoChangedEvent>("type-info-changed");
    private readonly properties = new Map<string, ISerializableProperty>();
    private readonly subTypes = new Map<string, SerializableType<any>>();

    readonly baseType?: SerializableType<any>;
    readonly serializer: IValueSerializer<T, any>;

    constructor(readonly ctor: Constructor<T>, readonly typeInfo?: SerializableTypeInfo<any>, serializer?: IValueSerializer<T, any>) {
        this._typeKey = typeInfo && typeInfo.typeKey ? typeInfo.typeKey : "__type";
        this._typeName =
            typeInfo && typeInfo.typeName
                ? typeof typeInfo.typeName === "string" ? typeInfo.typeName : typeInfo.typeName(this.ctor)
                : this.ctor.name;
        
        this.baseType = getBaseType(this.ctor);
        this.serializer = serializer || new ObjectSerializer<T>(this);

        if (this.baseType) {
            this.baseType.addSubType(this);
        }
    }

    get onTypeInfoChanged(): IEvent<TypeInfoChangedEvent> {
        return this.typeInfoChanged.event;
    }

    private _typeKey: string;
    get typeKey(): string {
        return this._typeKey;
    }

    private _typeName: string;
    get typeName(): string {
        return this._typeName;
    }

    addSubType(type: SerializableType<any>): void {
        if (this.subTypes.has(type.typeName)) {
            throw new Error(`Duplicate type name (${type.typeName})`);
        }

        type.onTypeInfoChanged(event => {
            this.subTypes.delete(event.oldTypeName);

            if (this.subTypes.has(event.type.typeName)) {
                throw new Error(`Duplicate type name (${event.type.typeName})`);
            }

            this.subTypes.set(event.type.typeName, event.type);
        });

        this.subTypes.set(type.typeName, type);
    }

    getSubType(typeName: string): SerializableType<any> {
        const type = this.tryGetSubType(typeName);

        if (!type) {
            throw new Error(`Subtype not found (${typeName})`);
        } 

        return type;
    }

    configure(options: PropertyOptions<T>): void {
        Object.keys(options).forEach(key => {
            if (this.properties.has(key)) {
                throw new Error(`Serialization options for property (${key}) already set`);
            }

            this.setProperty(key, (<any>options)[key]);
        });
    }

    setProperty(key: string, options?: SerializablePropertyOptions<any, any>): void {
        this.properties.set(key, {
            key,
            name: options && options.name || key,
            serializer: options && options.as,
            type: options && options.type ? getType(options.type) : undefined
        });
    }

    setTypeInfo(typeInfo: SerializableTypeInfo<any>): void {
        // it seems property decorators are invoked prior to class decorators...
        const oldTypeName = this._typeName;
        this._typeKey = typeInfo.typeKey || this._typeKey;

        if (typeInfo.typeName) {
            this._typeName = typeof typeInfo.typeName === "string" ? typeInfo.typeName : typeInfo.typeName(this.ctor)
        }

        this.typeInfoChanged.emit({ type: this, oldTypeName });
    }

    getProperties(obj?: any): [string, ISerializableProperty][] {
        const items = [
            ...Array.from(this.properties.entries()),
            ...this.getBaseProperties(this)
        ];

        if (!obj || !this.typeInfo || !this.typeInfo.autoRegisterProperties) {
            return items;
        }

        const map = new Map<string, [string, ISerializableProperty]>();
        items.forEach(item => map.set(item[0], item));

        for (const key of Object.keys(obj)) {
            if (!map.has(key)) {
                // check if a property was explicitly defined as serializable
                items.push([key, { key, name: key }]);
            }
        }

        return items;
    }

    shouldSerializeTypeInfo(): boolean {
        // only serialize the type info if the type is a sub type
        return this.baseType !== undefined;
    }

    /** Collect all the base serializable properties if the object is a subclass. */
    private getBaseProperties(type: SerializableType<any>): [string, ISerializableProperty][] {
        if (type.baseType) {
            return [
                ...type.baseType.getProperties(),
                ...this.getBaseProperties(type.baseType)
            ];
        }

        return [];
    }

    private tryGetSubType(typeName: string): SerializableType<any> | undefined {
        let type = this.subTypes.get(typeName);

        if (!type) {
            for (const entry of this.subTypes) {
                type = entry[1].tryGetSubType(typeName);

                if (type) {
                    break;
                }
            }
        }

        return type;
    }
}

// auto register type info for JSON objects
types.set(Object.prototype.constructor, new SerializableType(<Constructor<any>>Object.prototype.constructor, { autoRegisterProperties: true }));
// register primitive types
types.set(Boolean.prototype.constructor, new SerializableType(<Constructor<any>>Boolean.prototype.constructor, { autoRegisterProperties: false }, noOpValueSerializer));
types.set(Number.prototype.constructor, new SerializableType(<Constructor<any>>Number.prototype.constructor, { autoRegisterProperties: false }, noOpValueSerializer));
types.set(BigInt.prototype.constructor, new SerializableType(<Constructor<any>>BigInt.prototype.constructor, { autoRegisterProperties: false }, noOpValueSerializer));
types.set(String.prototype.constructor, new SerializableType(<Constructor<any>>String.prototype.constructor, { autoRegisterProperties: false }, noOpValueSerializer));
types.set(Symbol.prototype.constructor, new SerializableType(<Constructor<any>>Symbol.prototype.constructor, { autoRegisterProperties: false }, noOpValueSerializer));