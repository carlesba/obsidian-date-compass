import { test } from "node:test";
import { strict as assert } from "node:assert";
import { triggerClashes } from "../src/mentions/clashes.ts";
import type { TriggerOwner } from "../src/mentions/clashes.ts";
import type { EnabledPlugin } from "../src/mentions/conflicts.ts";

function mention(id: string, trigger: string): TriggerOwner {
	return { id, trigger };
}

const NLDATES: EnabledPlugin = { id: "nldates-obsidian", name: "Natural Language Dates", settings: { autocompleteTriggerPhrase: "@" } };

test("a trigger nobody else uses has no clashes", () => {
	const at = mention("a", "@");
	assert.deepEqual(triggerClashes(at, [at], [], undefined), []);
	assert.deepEqual(triggerClashes(at, [at, mention("b", "!")], [{ ...NLDATES, settings: { autocompleteTriggerPhrase: ";" } }], true), []);
	assert.deepEqual(triggerClashes(mention("a", "!"), [], [], true), []);
});

test("a blank trigger has no clashes and does not clash with others", () => {
	const blank = mention("a", "");
	assert.deepEqual(triggerClashes(blank, [blank, mention("b", ""), mention("c", "@")], [NLDATES], true), []);
	assert.deepEqual(triggerClashes(mention("c", "@"), [blank, mention("c", "@")], [], true), []);
});

test("two mentions with the same trigger clash once, however many share it", () => {
	const mentions = [mention("a", "@"), mention("b", "@"), mention("c", "@")];
	assert.deepEqual(triggerClashes(mentions[0], mentions, [], undefined), [{ kind: "duplicate" }]);
	assert.deepEqual(triggerClashes(mentions[2], mentions, [], undefined), [{ kind: "duplicate" }]);
});

test("a trigger that starts another, or starts with another, clashes in both directions", () => {
	const mentions = [mention("a", "@"), mention("b", "@@"), mention("c", "@@"), mention("d", "!")];
	assert.deepEqual(triggerClashes(mentions[0], mentions, [], undefined), [{ kind: "prefix", trigger: "@@" }]);
	assert.deepEqual(triggerClashes(mentions[1], mentions, [], undefined), [{ kind: "duplicate" }, { kind: "prefix", trigger: "@" }]);
	assert.deepEqual(triggerClashes(mentions[3], mentions, [], undefined), []);
	assert.deepEqual(triggerClashes(mention("e", "@@@"), mentions, [], undefined), [
		{ kind: "prefix", trigger: "@" },
		{ kind: "prefix", trigger: "@@" },
	]);
});

test("a trigger that overlaps an Obsidian suggester clashes with that feature", () => {
	const builtin = (trigger: string, slashCommandsEnabled?: boolean) => triggerClashes(mention("a", trigger), [], [], slashCommandsEnabled);
	assert.deepEqual(builtin("[["), [{ kind: "builtin", feature: "links", sequence: "[[" }]);
	assert.deepEqual(builtin("[[@"), [{ kind: "builtin", feature: "links", sequence: "[[" }]);
	assert.deepEqual(builtin("["), [
		{ kind: "builtin", feature: "links", sequence: "[[" },
		{ kind: "builtin", feature: "footnotes", sequence: "[^" },
	]);
	assert.deepEqual(builtin("#"), [{ kind: "builtin", feature: "tags", sequence: "#" }]);
	assert.deepEqual(builtin("#d"), [{ kind: "builtin", feature: "tags", sequence: "#" }]);
	assert.deepEqual(builtin("[^"), [{ kind: "builtin", feature: "footnotes", sequence: "[^" }]);
	assert.deepEqual(builtin("=="), [{ kind: "builtin", feature: "highlight", sequence: "==" }]);
	assert.deepEqual(builtin("="), [{ kind: "builtin", feature: "highlight", sequence: "==" }]);
	assert.deepEqual(builtin("@#"), []);
});

test("the slash clashes only when slash commands are known to be on", () => {
	const slash = mention("a", "/");
	assert.deepEqual(triggerClashes(slash, [slash], [], true), [{ kind: "builtin", feature: "slashCommands", sequence: "/" }]);
	assert.deepEqual(triggerClashes(mention("a", "//"), [], [], true), [{ kind: "builtin", feature: "slashCommands", sequence: "/" }]);
	assert.deepEqual(triggerClashes(slash, [slash], [], false), []);
	assert.deepEqual(triggerClashes(slash, [slash], [], undefined), []);
});

test("a plugin that opens on the same trigger clashes by name", () => {
	const at = mention("a", "@");
	const dateList: EnabledPlugin = { id: "date-list", name: "Date List", settings: {} };
	assert.deepEqual(triggerClashes(at, [at], [NLDATES, dateList], undefined), [
		{ kind: "plugin", name: "Natural Language Dates" },
		{ kind: "plugin", name: "Date List" },
	]);
	assert.deepEqual(triggerClashes(mention("a", "!"), [], [NLDATES, dateList], undefined), []);
});

test("clashes of every kind are listed together", () => {
	const mentions = [mention("a", "#"), mention("b", "#"), mention("c", "#t")];
	const tags: EnabledPlugin = { id: "note-compass", name: "Note Compass", settings: { mention: { enabled: true, trigger: "#" } } };
	assert.deepEqual(triggerClashes(mentions[0], mentions, [tags], true), [
		{ kind: "duplicate" },
		{ kind: "prefix", trigger: "#t" },
		{ kind: "builtin", feature: "tags", sequence: "#" },
		{ kind: "plugin", name: "Note Compass" },
	]);
});
