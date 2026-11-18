import { test } from "node:test";
import { strict as assert } from "node:assert";
import { activeMentionAt } from "../src/mentions/trigger.ts";

const AT = { id: "a", trigger: "@" };
const DOUBLE_AT = { id: "b", trigger: "@@" };
const HASH = { id: "c", trigger: "#" };

test("with one trigger inside another, the longest one that matches wins", () => {
	for (const mentions of [[AT, DOUBLE_AT], [DOUBLE_AT, AT]]) {
		assert.deepEqual(activeMentionAt("meet @@next w", mentions), { mention: DOUBLE_AT, match: { start: 5, query: "next w" } });
		assert.deepEqual(activeMentionAt("meet @next w", mentions), { mention: AT, match: { start: 5, query: "next w" } });
		assert.deepEqual(activeMentionAt("@@", mentions), { mention: DOUBLE_AT, match: { start: 0, query: "" } });
	}
});

test("with unrelated triggers, the one typed last wins", () => {
	for (const mentions of [[AT, HASH], [HASH, AT]]) {
		assert.deepEqual(activeMentionAt("@today #tomorrow", mentions), { mention: HASH, match: { start: 7, query: "tomorrow" } });
		assert.deepEqual(activeMentionAt("#today @tomorrow", mentions), { mention: AT, match: { start: 7, query: "tomorrow" } });
		assert.deepEqual(activeMentionAt("see #fri", mentions), { mention: HASH, match: { start: 4, query: "fri" } });
	}
});

test("the matched mention is returned as given", () => {
	assert.equal(activeMentionAt("@x", [AT, HASH])?.mention, AT);
});

test("nothing is active without a match, a mention or a trigger", () => {
	assert.equal(activeMentionAt("meet wed", [AT, DOUBLE_AT, HASH]), undefined);
	assert.equal(activeMentionAt("mail me@home", [AT, HASH]), undefined);
	assert.equal(activeMentionAt("meet @wed", []), undefined);
	assert.equal(activeMentionAt("meet @wed", [{ trigger: "" }]), undefined);
});
