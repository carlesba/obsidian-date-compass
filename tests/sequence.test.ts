import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { Analysis, Interpretation, ParseOptions, Refusal } from "../src/parse/index.ts";
import type { DateParser } from "../src/mentions/rows.ts";
import type { EditorPosition } from "obsidian";
import { insertAtCursor, insertLinks, previewSequence } from "../src/sequence/preview.ts";
import type { InsertionEditor, InsertionRange, SequenceContext } from "../src/sequence/preview.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

function context(overrides: Partial<SequenceContext> = {}): SequenceContext {
	return { now, moment, options, periods: defaultDateNotes().periods, ...overrides };
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

function fakeEditor(line: string, ch = line.length): InsertionEditor & { inserted: string[]; replaced: { text: string; range: InsertionRange }[] } {
	const inserted: string[] = [];
	const replaced: { text: string; range: InsertionRange }[] = [];
	return {
		inserted,
		replaced,
		getCursor: () => ({ line: 0, ch }),
		getLine: () => line,
		replaceSelection: (text: string) => void inserted.push(text),
		replaceRange: (text: string, start: EditorPosition, end?: EditorPosition) => void replaced.push({ text, range: { start, end: end ?? start } }),
	};
}

test("the previewed links are inserted at the cursor with the chosen separator", () => {
	const links = ["[[2026-11-23]]", "[[2026-11-24]]"];
	const bullets = fakeEditor("- ");
	insertAtCursor(bullets, links, "bulletLines");
	assert.deepEqual(bullets.inserted, ["[[2026-11-23]]\n- [[2026-11-24]]"]);
	const inline = fakeEditor("Due on ");
	insertAtCursor(inline, links, "space");
	assert.deepEqual(inline.inserted, ["[[2026-11-23]] [[2026-11-24]]"]);
});

test("links can replace the typed mention instead of the selection", () => {
	const editor = fakeEditor("Due @mon to tue");
	const range = { start: { line: 0, ch: 4 }, end: { line: 0, ch: 15 } };
	insertLinks(editor, ["[[a]]", "[[b]]"], "commaSpace", range);
	assert.deepEqual(editor.replaced, [{ text: "[[a]], [[b]]", range }]);
	insertLinks(editor, ["[[a]]"], "commaSpace");
	assert.deepEqual(editor.inserted, ["[[a]]"]);
});
