import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { Interpretation, ParseOptions, Refusal } from "../src/parse/index.ts";
import type { DateParser } from "../src/mentions/rows.ts";
import { previewSequence, sequenceInsertion } from "../src/sequence/preview.ts";
import type { SequenceContext } from "../src/sequence/preview.ts";
import { mergeSequence } from "../src/sequence/settings.ts";
import type { SequenceSettings } from "../src/sequence/settings.ts";
import { SEQUENCE_ITEM_TEMPLATE_KEY, SEQUENCE_LAYOUT_KEY, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { insertSequenceGroups } from "../src/settings/insertSequencePage.ts";
import { defaultSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

function context(overrides: Partial<SequenceContext> = {}): SequenceContext {
	return { now, moment, options, periods: defaultDateNotes().periods, allows: () => true, ...overrides };
}

const NO_PARSE: DateParser = { parse: () => [], complete: () => [] };

function previewText(query: string, overrides: Partial<SequenceContext> = {}): string | undefined {
	const preview = previewSequence(query, context(overrides));
	return preview.kind === "empty" ? undefined : preview.text;
}

test("the preview of a single date shows the date and the link it inserts", () => {
	assert.equal(previewText("tomorrow"), "Wed 18 Nov → [[2026-11-18]]");
});

test("the preview of a range counts its dates and shows both ends", () => {
	assert.equal(previewText("mon to fri"), "5 dates · Mon 23 – Fri 27 Nov");
	assert.equal(previewText("today to fri"), "4 dates · Tue 17 – Fri 20 Nov");
});

test("the preview of a sequence counts its dates and shows the first and the last", () => {
	const preview = previewSequence("every mon for 4 weeks", context());
	assert.equal(preview.kind, "dates");
	if (preview.kind !== "dates") return;
	assert.deepEqual(
		preview.notes.map((note) => note.name),
		["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"],
	);
	assert.equal(preview.text, "4 dates · Mon 23 Nov – Mon 14 Dec");
	assert.equal(previewText("W48 to W50"), "3 notes · Week of Mon 23 Nov – Week of Mon 7 Dec");
});

test("an empty input shows no preview", () => {
	assert.deepEqual(previewSequence("   ", context()), { kind: "empty" });
});

test("text that does not parse shows why", () => {
	assert.deepEqual(previewSequence("hello world", context()), { kind: "invalid", text: "This text is not a date, a range or a sequence." });
	assert.deepEqual(previewSequence("next week", context({ parser: NO_PARSE })), { kind: "invalid", text: "This text is not a date, a range or a sequence." });
	const periods = defaultDateNotes().periods;
	periods.week.enabled = false;
	assert.deepEqual(previewSequence("next week", context({ periods })), {
		kind: "invalid",
		text: "This phrase points to notes of a period that is turned off in Date notes.",
	});
});

test("a sequence the parser refuses as too long shows the over-limit message", () => {
	const refusal: Refusal = { language: "en", node: { kind: "day", amount: 0, unit: "day" }, reason: "tooManyItems", limit: 366 };
	const refusals = (text: string): Refusal[] => (text === "every day for 400 days" ? [refusal] : []);
	assert.deepEqual(previewSequence("every day for 400 days", context({ parser: NO_PARSE, refusals })), {
		kind: "invalid",
		text: "This makes more than 366 dates. Shorten the range or sequence.",
	});
});

test("a parseable interpretation wins over a refusal", () => {
	const interpretation: Interpretation = { language: "en", node: { kind: "day", amount: 0, unit: "day" }, result: { kind: "single", span: { unit: "day", start: "2026-11-17", end: "2026-11-17" } } };
	const parser: DateParser = { parse: () => [interpretation], complete: () => [] };
	const refusals = (): Refusal[] => [{ language: "en", node: interpretation.node, reason: "tooManyItems", limit: 366 }];
	assert.equal(previewText("today", { parser, refusals }), "Tue 17 Nov → [[2026-11-17]]");
});

const LINKS = ["[[2026-11-23]]", "[[2026-11-24]]", "[[2026-11-25]]"];

function settings(overrides: Partial<SequenceSettings>): SequenceSettings {
	return { ...mergeSequence(undefined), ...overrides };
}

test("the inline layout joins the links with the Mentions separator", () => {
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "inline" }), "commaSpace", "Due "), "[[2026-11-23]], [[2026-11-24]], [[2026-11-25]]");
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "inline" }), "space", "Due "), "[[2026-11-23]] [[2026-11-24]] [[2026-11-25]]");
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "inline" }), "bulletLines", ""), "- [[2026-11-23]]\n- [[2026-11-24]]\n- [[2026-11-25]]");
});

test("the bullet list layout puts one bullet per link, whatever the Mentions separator", () => {
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "bulletList" }), "commaSpace", ""), "- [[2026-11-23]]\n- [[2026-11-24]]\n- [[2026-11-25]]");
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "bulletList" }), "space", "  - "), "[[2026-11-23]]\n  - [[2026-11-24]]\n  - [[2026-11-25]]");
});

test("the one-per-line layout puts each link on its own line", () => {
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "linePerItem" }), "commaSpace", ""), "[[2026-11-23]]\n[[2026-11-24]]\n[[2026-11-25]]");
});

test("the item template wraps every link", () => {
	const template = settings({ layout: "linePerItem", itemTemplate: "- [ ] review {{link}} ({{link}})" });
	assert.equal(
		sequenceInsertion(LINKS.slice(0, 2), template, "commaSpace", ""),
		"- [ ] review [[2026-11-23]] ([[2026-11-23]])\n- [ ] review [[2026-11-24]] ([[2026-11-24]])",
	);
	assert.equal(sequenceInsertion(LINKS.slice(0, 2), settings({ layout: "inline", itemTemplate: "on {{link}}" }), "commaSpace", ""), "on [[2026-11-23]], on [[2026-11-24]]");
});

test("insert sequence settings default to inline with the bare link and refuse unknown stored values", () => {
	assert.deepEqual(mergeSequence(undefined), { layout: "inline", itemTemplate: "{{link}}" });
	assert.deepEqual(mergeSequence({ layout: "table", itemTemplate: "no link" }), { layout: "inline", itemTemplate: "{{link}}" });
	assert.deepEqual(mergeSequence({ layout: "bulletList", itemTemplate: "[ ] {{link}}" }), { layout: "bulletList", itemTemplate: "[ ] {{link}}" });
});

test("the Insert sequence subpage reads and writes its two controls through controlKeys", () => {
	const keys = insertSequenceGroups().flatMap((group) => (group.items ?? []).flatMap((item) => ("control" in item && item.control ? [item.control.key] : [])));
	assert.deepEqual(keys, [SEQUENCE_LAYOUT_KEY, SEQUENCE_ITEM_TEMPLATE_KEY]);
	const stored = defaultSettings();
	assert.equal(readControl(stored, SEQUENCE_LAYOUT_KEY), "inline");
	assert.equal(readControl(stored, SEQUENCE_ITEM_TEMPLATE_KEY), "{{link}}");
	assert.equal(writeControl(stored, SEQUENCE_LAYOUT_KEY, "bulletList"), true);
	assert.equal(writeControl(stored, SEQUENCE_LAYOUT_KEY, "table"), false);
	assert.equal(writeControl(stored, SEQUENCE_ITEM_TEMPLATE_KEY, "- [ ] {{link}}"), true);
	assert.equal(writeControl(stored, SEQUENCE_ITEM_TEMPLATE_KEY, "- [ ] "), false);
	assert.equal(writeControl(stored, SEQUENCE_ITEM_TEMPLATE_KEY, 3), false);
	assert.deepEqual(stored.insertSequence, { layout: "bulletList", itemTemplate: "- [ ] {{link}}" });
	assert.equal(readControl(stored, SEQUENCE_LAYOUT_KEY), "bulletList");
	assert.equal(readControl(stored, SEQUENCE_ITEM_TEMPLATE_KEY), "- [ ] {{link}}");
});
