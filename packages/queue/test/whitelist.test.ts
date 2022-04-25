import { isQueueNameMatch, isQueueNamePattern } from "../src/whitelist";

describe("queue adapter whitelist", () => {
    test("verify queue name is a pattern", () => {
        expect(isQueueNamePattern("")).toBe(false);
        expect(isQueueNamePattern("foo")).toBe(false);
        expect(isQueueNamePattern("foo:*")).toBe(true);
        expect(isQueueNamePattern("*")).toBe(true);
    });

    test("verify queue name pattern match", () => {
        expect(isQueueNameMatch("", "foo")).toBe(false);
        expect(isQueueNameMatch("foo", "foo")).toBe(true);
        expect(isQueueNameMatch("foo", "fo*")).toBe(false);
        expect(isQueueNameMatch("*oo", "foo")).toBe(true);
        expect(isQueueNameMatch("f*o", "foo")).toBe(true);
        expect(isQueueNameMatch("f*oo", "foo")).toBe(true);
        expect(isQueueNameMatch("foo*", "foo")).toBe(true);
        expect(isQueueNameMatch("foo:*", "foo")).toBe(false);
        expect(isQueueNameMatch("foo:*", "foo:bar")).toBe(true);
        expect(isQueueNameMatch("foo:*", "foo:bar:1")).toBe(true);
        expect(isQueueNameMatch("foo:*:*", "foo:bar:1")).toBe(true);
        expect(isQueueNameMatch("foo:*:1", "foo:bar:1")).toBe(true);
        expect(isQueueNameMatch("foo:*:1", "foo:bar:*")).toBe(false);
        expect(isQueueNameMatch("foo:*", "foo:*:*")).toBe(true);
        expect(isQueueNameMatch("*", "foo")).toBe(true);
    });
});