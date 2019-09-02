import { EventEmitter, IEvent } from "../src";

describe("event emmitter", () => {
    test("on event", () => {
        const foo = new Foo();
        let flag = false;
        
        foo.onAChanged(() => flag = true);
        foo.a = "a";

        expect(flag).toBeTruthy();
    });

    test("aggregate with same type", () => {
        const foo = new Foo();
        let count = 0;

        foo.onAChanged.aggregate(foo.onBChanged).on(() => count++);

        foo.a = "a";
        foo.b = "b";
        foo.c = "c";
        foo.d = "d";

        expect(count).toBe(2);
    });

    test("aggregate chain", () => {
        const foo = new Foo();
        let count = 0;

        foo.onAChanged
            .aggregate(
                foo.onBChanged.aggregate(
                foo.onCChanged.aggregate(
                foo.onDChanged)))
            .on(() => count++);

        foo.a = "a";
        foo.b = "b";
        foo.c = "c";
        foo.d = "d";

        expect(count).toBe(4);
    });

    jest.useFakeTimers();
    test("debounce single emit", () => {
        const foo = new Foo();

        let count = 0;
        let value: string | undefined;
        foo.onAChanged.debounce(1).on(() => { 
            count++;
            value = foo.a;
        });

        foo.a = "a";
        foo.a = "b";

        jest.runAllTimers();

        expect(count).toBe(1);
        expect(value).toBe("b");
    });

    jest.useFakeTimers();
    test("debounce multiple emit", () => {
        const foo = new Foo();
        const result: string[] = [];

        foo.onAChanged.debounce(1).on(() => result.push(foo.a));

        foo.a = "a"
        foo.a = "b";

        setTimeout(() => { 
            foo.a = "c";
            foo.a = "d";
        }, 2);

        // trigger the first emit
        jest.advanceTimersByTime(2);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe("b");

        // trigger the next foo modification and second debounce
        jest.advanceTimersByTime(1);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe("b");
        expect(result[1]).toBe("d");
    });

    jest.useFakeTimers();
    test("debounce with delayed emit", () => {
        const foo = new Foo();

        let count = 0;
        let value: string | undefined;
        foo.onAChanged.debounce(2).on(() => { 
            count++;
            value = foo.a;
        });

        foo.a = "a"
        setTimeout(() => foo.a = "b", 1);
        setTimeout(() => foo.a = "c", 1);
        setTimeout(() => foo.a = "d", 1);
        setTimeout(() => foo.a = "e", 1);
        setTimeout(() => foo.a = "f", 1);
        setTimeout(() => foo.a = "g", 1);
        setTimeout(() => foo.a = "h", 1);

        jest.runAllTimers();

        expect(count).toBe(1);
        expect(value).toBe("h");
    });

    jest.useFakeTimers();
    test("debounce multiple event subscriptions", () => {
        const foo = new Foo();
        const result1: string[] = [];
        const result2: string[] = [];
        const result3: string[] = [];

        const event = foo.onAChanged.debounce(2);

        event.on(event => result1.push(event.value));
        event.on(event => result2.push(event.value));
        event.on(event => result3.push(event.value));

        foo.a = "a";
        setTimeout(() => foo.a = "b", 1);
        setTimeout(() => { 
            foo.a = "c";
            foo.a = "d";
        }, 3);

        jest.runAllTimers();

        expect(result1).toHaveLength(2);
        expect(result1[0]).toBe("b");
        expect(result1[1]).toBe("d");

        expect(result2).toHaveLength(2);
        expect(result2[0]).toBe("b");
        expect(result2[1]).toBe("d");

        expect(result3).toHaveLength(2);
        expect(result3[0]).toBe("b");
        expect(result3[1]).toBe("d");
    });

    jest.useFakeTimers();
    test("debounce with reducer", () => {
        const foo = new Foo();

        let value: string | undefined;
        foo.onAChanged.debounce(2, (acc, cur) => ({ value: acc.value + cur.value })).on(event => value = event.value);

        foo.a = "a";
        foo.a = "b";
        setTimeout(() => foo.a = "c", 1);

        jest.runAllTimers();

        expect(foo.a).toBe("c");
        expect(value).toBe("abc");
    });

    test("map results", () => {
        const foo = new Foo();

        let result: string;
        foo.onValuesChanged.map(event => event[0].value).on(event => result = event);
        
        foo.begin();
        foo.a = "a";
        foo.end();

        expect(result!).toBe("a");
    });

    test("once", () => {
        const foo = new Foo();

        let count = 0;
        foo.onAChanged.once(() => count++);

        foo.a = "a";
        foo.a = "b";

        expect(count).toBe(1);
    });

    test("once removed before raised", () => {
        const foo = new Foo();

        let count = 0;
        foo.onAChanged.once(() => count++).remove();
    
        foo.a = "a";
        foo.a = "b";

        expect(count).toBe(0);
    });

    test("once with filter", () => {
        const foo = new Foo();

        let count = 0;
        foo.onAChanged.filter(() => foo.a === "b").once(() => count++);

        foo.a = "a";
        expect(count).toBe(0);

        foo.a = "b";
        expect(count).toBe(1);

        foo.a = "c";
        expect(count).toBe(1);
    });

    test("split array results", () => {
        const foo = new Foo();
        const results: string[] = [];

        foo.onValuesChanged.split(event => event).on(event => results.push(event.value));
        
        foo.begin();
        foo.a = "a";
        foo.b = "b";
        foo.c = "c";
        foo.end();

        expect(results).toHaveLength(3);
        expect(results[0]).toBe("a");
        expect(results[1]).toBe("b");
        expect(results[2]).toBe("c");
    });

    test("split array with single result", () => {
        const foo = new Foo();
        const results: string[] = [];
        
        foo.onValuesChanged.split(event => event).on(event => results.push(event.value));

        foo.begin();
        foo.a = "a";
        foo.end();

        expect(results).toHaveLength(1);
        expect(results[0]).toBe("a");
    });

    test("unregister event before emit", () => {
        const foo = new Foo();

        let count = 0;
        const event = foo.onAChanged.filter(() => foo.a === "b").once(() => count++);

        event.remove();

        foo.a = "a";
        foo.a = "b";
        foo.a = "c";

        expect(count).toBe(0);
    });
});

class Foo {
    private readonly aChanged = new EventEmitter<{ value: string }>("a-changed");
    private readonly bChanged = new EventEmitter<{ value: string }>("b-changed");
    private readonly cChanged = new EventEmitter<{ value: string }>("c-changed");
    private readonly dChanged = new EventEmitter<{ value: string }>("d-changed");
    private readonly valuesChanged = new EventEmitter<{ key: string, value: string }[]>("values-changed");

    private changes: { [key: string]: string } = {};

    get onAChanged(): IEvent<{ value: string }> {
        return this.aChanged.event;
    }

    get onBChanged(): IEvent<{ value: string }> {
        return this.bChanged.event;
    }

    get onCChanged(): IEvent<{ value: string }> {
        return this.cChanged.event;
    }

    get onDChanged(): IEvent<{ value: string }> {
        return this.dChanged.event;
    }

    get onValuesChanged(): IEvent<{ key: string, value: string }[]> {
        return this.valuesChanged.event;
    }

    begin(): void {
        this.changes = {};
    }

    end(): void {
        const result: { key: string, value: string }[] = [];
        Object.keys(this.changes).forEach(key => result.push({ key, value: this.changes[key] }));
        this.valuesChanged.emit(result);
        this.changes = {};
    }

    private _a = "";
    get a(): string {
        return this._a;
    }

    set a(value: string) {
        if (this._a !== value) {
            this._a = value;
            this.changes["a"] = value;
            this.aChanged.emit({ value });
        }
    }

    private _b = "";
    get b(): string {
        return this._b;
    }

    set b(value: string) {
        if (this._b !== value) {
            this._b = value;
            this.changes["b"] = value;
            this.bChanged.emit({ value });
        }
    }

    private _c = "";
    get c(): string {
        return this._c;
    }

    set c(value: string) {
        if (this._c !== value) {
            this._c = value;
            this.changes["c"] = value;
            this.cChanged.emit({ value });
        }
    }

    private _d = "";
    get d(): string {
        return this._d;
    }

    set d(value: string) {
        if (this._d !== value) {
            this._d = value;
            this.changes["d"] = value;
            this.dChanged.emit({ value });
        }
    }
}