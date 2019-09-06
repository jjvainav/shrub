import { configureType, JSONSerializer, IJSONSerializerContext, ISerializableType, ITypeSerializer, NumericString, Serializable, Serialize, UnixTime } from "../src";

describe("serialize", () => {
    test("simple object", () => {
        const obj = new SimpleObject();

        obj.foo = "foo!";
        obj.fooBar = "foobar";
        obj.date = new Date(1517461200000);
        obj.numAsString = 10;
        obj.items = [
            { value: 1 },
            { value: 2 },
            { value: 3 }
        ];

        const result = new JSONSerializer().serialize(obj);
        
        expect(result.hello).toBeUndefined();
        expect(result.foo).toBe("foo!");
        expect(result.bar).toBeUndefined();
        expect(result["foo-bar"]).toBe("foobar");
        expect(result.date).toBe(1517461200);
        expect(result.num).toBe("10");

        const items = <{ readonly value: number }[]>result.items;
        expect(items).toBeDefined();
        expect(items).toHaveLength(3);

        for (let i = 0; i < items.length; i++) {
            expect(items[i].value).toBe(i + 1);
        }
    });

    test("simple object - empty", () => {
        const obj = new SimpleObject();
        
        const result = new JSONSerializer().serialize(obj);

        // none of the serializable properties are defined so the result should be an empty object
        expect(Object.keys(result)).toHaveLength(0);
    });

    test("object without decorators", () => {
        const obj = new ObjectWithoutDecorators();

        obj.foo = new Foo();
        obj.bar = new Bar();

        obj.foo.foo = "foo";
        obj.bar.bar = "bar";

        const result = new JSONSerializer().serialize(obj);
        
        expect(result.hello).toBe("hello");
        expect(result.foo.foo).toBe("foo");
        expect(result.bar.bar).toBe("bar");
        expect(result.getFooBar).toBeUndefined();
    });

    test("nested object", () => {
        const obj = new NestedObject();

        obj.name = "nested";

        obj.value = new SimpleObject();
        obj.value.foo = "foo";
        obj.value.bar = "bar";

        const obj1 = new SimpleObject();
        obj1.foo = "foo 1";
        obj1.bar = "bar 1";

        const obj2 = new SimpleObject();
        obj2.foo = "foo 2";
        obj2.bar = "bar 2";

        obj.values = [obj1, obj2];

        obj.value2 = { num: 10 };

        const result = new JSONSerializer().serialize(obj);
        
        expect(result.name).toBe("nested");

        expect(result.value).toBeDefined();
        expect(result.value.hello).toBeUndefined(); // this property is not marked as serialize
        expect(result.value.foo).toBe("foo");
        expect(result.value.bar).toBe("bar");

        expect(result.values).toHaveLength(2);
        expect(result.values[0].foo).toBe("foo 1");
        expect(result.values[0].bar).toBe("bar 1");
        expect(result.values[1].foo).toBe("foo 2");
        expect(result.values[1].bar).toBe("bar 2");

        expect(result.value2).toBeDefined();
        expect(result.value2.num).toBe(10);
    });

    test("nested object without decorators", () => {
        const obj = {
            id: "123",
            foo: { f: "foo" },
            bar: { b: "bar" }
        };

        const result = new JSONSerializer().serialize(obj);
        
        expect(result.id).toBe("123");
        expect(result.foo.f).toBe("foo");
        expect(result.bar.b).toBe("bar");
    });
    
    test("has constructor object", () => {
        const obj = new HasConstructorObject("foo", "bar");

        const result = new JSONSerializer().serialize(obj);

        expect(result.foo).toBe("foo");
        expect(result.bar).toBe("bar");
    });

    test("inheritance", () => {
        const obj = new SubObject("hello");
        obj.foo = "foo";

        const result = new JSONSerializer().serialize(obj);

        expect(result.__type).toBe("sub");
        expect(result.foo).toBe("foo");
        expect(result.v).toBe("hello");
    });

    test("inheritance without serialize property", () => {
        const obj = new SerializableSubObject("hello");

        const result = new JSONSerializer().serialize(obj);

        expect(result.__type).toBe("SerializableSubObject");
        expect(result.foo).toBeUndefined();
        expect(result.v).toBe("hello");
    });

    test("overridden type info", () => {
        const obj = new FooTypeObject();

        const result = new JSONSerializer().serialize(obj);

        expect(result.ty).toBe("foo");
    });

    test("custom type serializer", () => {
        const obj = new CustomTypeSerializerObject();

        obj.name = "custom";

        obj.value = new SimpleObject();
        obj.value.foo = "foo";
        obj.value.bar = "bar";

        const result = new JSONSerializer({ typeSerializer: new SimpleObjectTestTypeSerializer() }).serialize(obj);

        expect(result.name).toBe("custom");

        expect(result.value).toBeDefined();
        expect(result.value.id).toBe(1);
        expect(result.value.foo).toBeUndefined();
        expect(result.value.bar).toBeUndefined();
    });
});

describe("deserialize", () => {
    test("simple object", () => {
        const json = {
            foo: "foo!",
            "foo-bar": "foobar",
            date: 1517461200,
            num: "10",
            items: [{ value: 1 }, { value: 2 }, { value: 3 }]
        };
        
        const obj = new JSONSerializer().deserialize(json, SimpleObject);
        
        expect(obj.foo).toBe("foo!");
        expect(obj.fooBar).toBe("foobar");
        expect(obj.date.getTime()).toBe(1517461200000);
        expect(obj.numAsString).toBe(10);

        expect(obj.items).toHaveLength(3);

        for (let i = 0; i < obj.items.length; i++) {
            expect(obj.items[i].value).toBe(i + 1);
        }
    });

    test("simple object - empty", () => {
        const obj = new JSONSerializer().deserialize({}, SimpleObject);

        // the object should only have 1 property - the default hello prop
        expect(Object.keys(obj)).toHaveLength(1);
    });

    test("nested object", () => {
        const json = {
            name: "nested",
            value: {
                foo: "foo",
                bar: "bar"
            },
            values: [
                {
                    foo: "foo 1",
                    bar: "bar 1"
                },
                {
                    foo: "foo 2",
                    bar: "bar 2"
                }
            ],
            value2: {
                num: 10
            }
        };

        const obj = new JSONSerializer().deserialize(json, NestedObject);

        expect(obj.name).toBe("nested");

        expect(obj.value.foo).toBe("foo");
        expect(obj.value.bar).toBe("bar");

        expect(obj.values).toHaveLength(2);
        expect(obj.values[0].foo).toBe("foo 1");
        expect(obj.values[0].bar).toBe("bar 1");
        expect(obj.values[1].foo).toBe("foo 2");
        expect(obj.values[1].bar).toBe("bar 2");

        expect(obj.value2.num).toBe(10);
    });

    test("object without decorators", () => {
        const json = {
            hello: "test",
            foo: { foo: "foo" },
            bar: { bar: "bar" }
        };

        configureType(ObjectWithoutDecorators, {
            foo: { type: Foo },
            bar: { type: Bar }
        });

        const obj = new JSONSerializer().deserialize(json, ObjectWithoutDecorators);

        expect(obj.hello).toBe("test");
        expect(obj.foo).toBeInstanceOf(Foo);
        expect(obj.bar).toBeInstanceOf(Bar);
        expect(obj.foo.foo).toBe("foo");
        expect(obj.bar.bar).toBe("bar");
        expect(obj.getFooBar()).toBe("foobar");
    });    

    test("has constructor object", () => {
        const json = {
            foo: "foo",
            bar: "bar"
        };

        const obj = new JSONSerializer().deserialize(json, HasConstructorObject);

        expect(obj.foo).toBe("foo");
        expect(obj.bar).toBe("bar");
    });

    test("inheritance", () => {
        const json = {
            foo: "foo",
            v: "hello"
        };

        const obj = new JSONSerializer().deserialize(json, SubObject);

        expect(obj.foo).toBe("foo");
        expect(obj.value).toBe("hello");
    });

    test("inheritance from base type", () => {
        const json = {
            __type: "sub",
            foo: "foo",
            v: "hello"
        };

        const obj = <SubObject>(new JSONSerializer().deserialize(json, BaseObject));

        expect(obj.foo).toBe("foo");
        expect(obj.value).toBe("hello");
    });

    test("inheritance without serialize property", () => {
        const json = {
            __type: "SerializableSubObject",
            v: "hello"
        };

        const obj = new JSONSerializer().deserialize(json, SerializableSubObject);

        expect(obj.foo).toBe("foo");
        expect(obj.value).toBe("hello");
    });

    test("overridden type info", () => {
        const json = {
            ty: "foo"
        };

        const obj = new JSONSerializer().deserialize(json, CustomBaseTypeObject);

        expect(obj).toBeInstanceOf(FooTypeObject);
    });

    test("custom type serializer", () => {
        const json = {
            name: "custom",
            value: { id: 1 }
        };

        const value = new SimpleObject();
        value.foo = "foo";
        value.bar = "bar";
        
        const obj = new JSONSerializer({ typeSerializer: new SimpleObjectTestTypeSerializer(value) }).deserialize(json, CustomTypeSerializerObject);
        
        expect(obj.name).toBe("custom");

        expect(obj.value.foo).toBe("foo");
        expect(obj.value.bar).toBe("bar");
    });

    test("custom object factory", () => {
        const serializer = new JSONSerializer({
            factory: ctor => {
                const obj = new ctor();
                if (obj instanceof SimpleObject) {
                    obj.foo = "foo";
                }

                return obj;
            }
        });

        const obj = serializer.deserialize({}, SimpleObject);
        
        expect(obj.hello).toBe("hello");
        expect(obj.foo).toBe("foo");
    });
});

class SimpleObjectTestTypeSerializer implements ITypeSerializer {
    // a test object to return during deserialization
    constructor(readonly obj?: SimpleObject) {
    }

    serialize(context: IJSONSerializerContext, type: ISerializableType, obj: any): any {
        if (type.ctor === SimpleObject) {
            return { id: 1 };
        }

        return type.serializer.serialize(context, obj);
    }

    deserialize(context: IJSONSerializerContext, type: ISerializableType, json: any): any {
        if (type.ctor === SimpleObject) {
            if (json.id !== 1) {
                throw new Error("Invalid Json");
            }

            if (this.obj === undefined) {
                throw new Error("Object not defined");
            }

            return this.obj;
        }

        return type.serializer.deserialize(context, json);
    }
}

class SimpleObject {
    hello = "hello";

    @Serialize() foo: string;
    @Serialize() bar: string;

    @Serialize({ name: "foo-bar" }) fooBar: string;

    @Serialize({ as: UnixTime }) date: Date;
    @Serialize({ name: "num", as: NumericString }) numAsString: number;

    @Serialize() items: { readonly value: number }[];
}

class NestedObject {
    @Serialize({ type: String }) name: string;
    @Serialize({ type: SimpleObject }) value: SimpleObject;
    @Serialize({ type: SimpleObject }) values: SimpleObject[];
    @Serialize({ type: Object }) value2: { readonly num: number };
}

class CustomTypeSerializerObject {
    @Serialize() name: string;
    @Serialize({ type: SimpleObject }) value: SimpleObject;
}

class HasConstructorObject {
    @Serialize({ type: String }) foo: string;
    @Serialize({ type: String }) bar: string;

    constructor(foo: string, bar: string) {
        this.foo = foo;
        this.bar = bar;
    }
}

class BaseObject {
    @Serialize({ type: String, name: "v" }) readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

@Serializable({ typeName: "sub" })
class SubObject extends BaseObject {
    @Serialize({ type: String }) foo: string;

    constructor(value: string) {
        super(value);
    }
}

@Serializable()
class SerializableSubObject extends BaseObject {
    foo = "foo";
}

@Serializable({ typeKey: "ty" })
class CustomBaseTypeObject {
    static readonly type: string;
}

@Serializable({
    typeKey: "ty",
    typeName: (ctor: typeof FooTypeObject) => ctor.type
})
class FooTypeObject extends CustomBaseTypeObject {
    static readonly type = "foo";
}

class Foo {
    foo: string;
}

class Bar {
    bar: string;
}

class ObjectWithoutDecorators {
    hello = "hello";

    foo: Foo;
    bar: Bar;

    getFooBar(): string {
        return this.foo.foo + this.bar.bar;
    }
}