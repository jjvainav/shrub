import { isChannelNameMatch, isChannelNamePattern } from "../src/whitelist";

describe("channel whitelist", () => {
    test("verify channel name is a pattern", () => {
        expect(isChannelNamePattern("")).toBe(false);
        expect(isChannelNamePattern("foo")).toBe(false);
        expect(isChannelNamePattern("foo:*")).toBe(true);
        expect(isChannelNamePattern("*")).toBe(true);
    });

    test("verify channel name pattern match", () => {
        expect(isChannelNameMatch("", "foo")).toBe(false);
        expect(isChannelNameMatch("foo", "foo")).toBe(true);
        expect(isChannelNameMatch("foo", "fo*")).toBe(false);
        expect(isChannelNameMatch("*oo", "foo")).toBe(true);
        expect(isChannelNameMatch("f*o", "foo")).toBe(true);
        expect(isChannelNameMatch("f*oo", "foo")).toBe(true);
        expect(isChannelNameMatch("foo*", "foo")).toBe(true);
        expect(isChannelNameMatch("foo:*", "foo")).toBe(false);
        expect(isChannelNameMatch("foo:*", "foo:bar")).toBe(true);
        expect(isChannelNameMatch("foo:*:*", "foo:bar:1")).toBe(true);
        expect(isChannelNameMatch("foo:*:1", "foo:bar:1")).toBe(true);
        expect(isChannelNameMatch("foo:*:1", "foo:bar:*")).toBe(false);
        expect(isChannelNameMatch("foo:*", "foo:*:*")).toBe(true);
        expect(isChannelNameMatch("*", "foo")).toBe(true);
    });
});