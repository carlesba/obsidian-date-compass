import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { Analysis, Interpretation, ParseOptions, Refusal } from "../src/parse/index.ts";
import type { DateParser } from "../src/mentions/rows.ts";
import { insertAtCursor, previewSequence, sequenceInsertion } from "../src/sequence/preview.ts";
import type { CursorEditor, SequenceContext, SequencePreview } from "../src/sequence/preview.ts";
import { mergeSequence } from "../src/sequence/settings.ts";
import type { SequenceSettings } from "../src/sequence/settings.ts";
import { SEQUENCE_ITEM_TEMPLATE_KEY, SEQUENCE_LAYOUT_KEY, itemTemplateError, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { insertSequenceGroups } from "../src/settings/insertSequencePage.ts";
import { defaultSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

function context(overrides: Partial<SequenceContext> = {}): SequenceContext {
	return { now, moment, options, periods: defaultDateNotes().periods, allows: () => true, ...overrides };
}

const NO_PARSE: DateParser = { parse: () => [], complete: () => [] };

const NO_ANALYSIS = (): Analysis => ({ interpretations: [], refusals: [] });

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
	assert.deepEqual(previewSequence("next week", context({ parser: NO_PARSE, analyze: NO_ANALYSIS })), { kind: "invalid", text: "This text is not a date, a range or a sequence." });
	const periods = defaultDateNotes().periods;
	periods.week.enabled = false;
	assert.deepEqual(previewSequence("next week", context({ periods })), {
		kind: "invalid",
		text: "This phrase points to notes of a period that is turned off in Date notes.",
	});
});

test("an unfinished phrase suggests how to finish it", () => {
	assert.deepEqual(previewSequence("next we", context()), { kind: "invalid", text: "Keep typing, as in next wed." });
});

test("a sequence the parser refuses as too long shows the over-limit message", () => {
	assert.deepEqual(previewSequence("every day for 400 days", context()), {
		kind: "invalid",
		text: "This makes more than 366 dates. Shorten the range or sequence.",
	});
	const refusal: Refusal = { language: "es", node: { kind: "day", amount: 0, unit: "day" }, reason: "tooManyItems", limit: 366 };
	const analyze = (text: string): Analysis => ({ interpretations: [], refusals: text === "cada dia durante 400 dias" ? [refusal] : [] });
	assert.deepEqual(previewSequence("cada dia durante 400 dias", context({ parser: NO_PARSE, analyze })), {
		kind: "invalid",
		text: "This makes more than 366 dates. Shorten the range or sequence.",
	});
});

test("the over-limit message wins over a turned-off period", () => {
	const periods = defaultDateNotes().periods;
	periods.day.enabled = false;
	assert.equal(previewText("every day for 400 days", { periods }), "This makes more than 366 dates. Shorten the range or sequence.");
});

test("a parseable interpretation wins over a refusal", () => {
	const interpretation: Interpretation = { language: "en", node: { kind: "day", amount: 0, unit: "day" }, result: { kind: "single", span: { unit: "day", start: "2026-11-17", end: "2026-11-17" } } };
	const parser: DateParser = { parse: () => [interpretation], complete: () => [] };
	const analyze = (): Analysis => ({ interpretations: [interpretation], refusals: [{ language: "en", node: interpretation.node, reason: "tooManyItems", limit: 366 }] });
	assert.equal(previewText("today", { parser, analyze }), "Tue 17 Nov → [[2026-11-17]]");
	assert.equal(previewText("gibberish", { parser: NO_PARSE, analyze: NO_ANALYSIS }), "This text is not a date, a range or a sequence.");
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
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "bulletList" }), "space", "Due "), "\n- [[2026-11-23]]\n- [[2026-11-24]]\n- [[2026-11-25]]");
	assert.equal(sequenceInsertion(LINKS.slice(0, 1), settings({ layout: "bulletList" }), "commaSpace", ""), "- [[2026-11-23]]");
});

test("the one-per-line layout puts each link on its own line", () => {
	assert.equal(sequenceInsertion(LINKS, settings({ layout: "linePerItem" }), "commaSpace", ""), "[[2026-11-23]]\n[[2026-11-24]]\n[[2026-11-25]]");
	assert.equal(sequenceInsertion(LINKS.slice(0, 2), settings({ layout: "linePerItem" }), "commaSpace", "  "), "[[2026-11-23]]\n  [[2026-11-24]]");
	assert.equal(sequenceInsertion(LINKS.slice(0, 2), settings({ layout: "linePerItem" }), "commaSpace", "  Due "), "\n  [[2026-11-23]]\n  [[2026-11-24]]");
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

function fakeEditor(line: string, ch = line.length): CursorEditor & { inserted: string[] } {
	const inserted: string[] = [];
	return {
		inserted,
		getCursor: () => ({ line: 0, ch }),
		getLine: () => line,
		replaceSelection: (text: string) => void inserted.push(text),
	};
}

test("Enter inserts the previewed links at the cursor in the chosen layout", () => {
	const preview = previewSequence("every mon for 4 weeks", context());
	const editor = fakeEditor("- ");
	const linkTo = (note: { name: string }) => `[[${note.name}]]`;
	assert.equal(insertAtCursor(editor, preview, linkTo, settings({ layout: "bulletList", itemTemplate: "Review {{link}}" }), "commaSpace"), true);
	assert.deepEqual(editor.inserted, ["Review [[2026-11-23]]\n- Review [[2026-11-30]]\n- Review [[2026-12-07]]\n- Review [[2026-12-14]]"]);
	const inline = fakeEditor("Due on ");
	assert.equal(insertAtCursor(inline, previewSequence("mon to wed", context()), linkTo, settings({ layout: "inline" }), "space"), true);
	assert.deepEqual(inline.inserted, ["[[2026-11-23]] [[2026-11-24]] [[2026-11-25]]"]);
});

test("Enter inserts nothing while the text does not parse", () => {
	const editor = fakeEditor("");
	const invalid: SequencePreview = previewSequence("hello world", context());
	assert.equal(insertAtCursor(editor, invalid, () => "x", settings({}), "commaSpace"), false);
	assert.equal(insertAtCursor(editor, { kind: "empty" }, () => "x", settings({}), "commaSpace"), false);
	assert.deepEqual(editor.inserted, []);
});

test("an item template without {{link}} is refused with a message", () => {
	assert.equal(itemTemplateError("- [ ] "), "Include {{link}} where the link goes.");
	assert.equal(itemTemplateError("- [ ] {{link}}"), undefined);
});
