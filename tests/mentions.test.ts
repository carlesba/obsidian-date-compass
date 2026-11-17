import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { Period } from "../src/dateNotes/periods.ts";
import type { Completion, Interpretation, ParseOptions, Unit } from "../src/parse/index.ts";
import { buildRows, mayStillMatch, mentionAllows, rowLabel, singleNoteRows } from "../src/mentions/rows.ts";
import type { DateParser, RowContext } from "../src/mentions/rows.ts";
import { mergeMentions } from "../src/mentions/settings.ts";
import { isDeadEnd, isDismissed, isInCode, mentionAt } from "../src/mentions/trigger.ts";
import { sameTriggerPlugins } from "../src/mentions/conflicts.ts";
import { unsavedFile } from "../src/mentions/obsidianHost.ts";
import { parseOptionsOf, parserWeekStart } from "../src/parseOptions.ts";
import { defaultSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

function context(overrides: Partial<RowContext> = {}): RowContext {
	return { now, moment, options, periods: defaultDateNotes().periods, allows: () => true, ...overrides };
}

function interpretation(unit: Unit, start: string, end = start, language = "en"): Interpretation {
	return { language, node: { kind: "day", amount: 0, unit: "day" }, result: { kind: "single", span: { unit, start, end } } };
}

function fakeParser(results: Record<string, Interpretation[]>, completions: Record<string, Completion[]> = {}): DateParser {
	return { parse: (text) => results[text] ?? [], complete: (text) => completions[text] ?? [] };
}

test("a mention opens right after the trigger and its query may contain spaces", () => {
	assert.deepEqual(mentionAt("meet @", "@"), { start: 5, query: "" });
	assert.deepEqual(mentionAt("meet @last wed", "@"), { start: 5, query: "last wed" });
	assert.deepEqual(mentionAt("@today to fri", "@"), { start: 0, query: "today to fri" });
	assert.deepEqual(mentionAt("see ;;next w", ";;"), { start: 4, query: "next w" });
	assert.deepEqual(mentionAt("@today mail me@home", "@"), { start: 0, query: "today mail me@home" });
	assert.deepEqual(mentionAt("a @b c@d", "@"), { start: 2, query: "b c@d" });
});

test("Escape keeps a mention closed while it is typed, a dead end only until the query is shortened", () => {
	assert.equal(isDismissed(undefined, "a.md:0:0", "wed"), false);
	assert.equal(isDismissed({ position: "a.md:0:0" }, "a.md:0:0", "w"), true);
	assert.equal(isDismissed({ position: "a.md:0:0" }, "a.md:0:4", "w"), false);
	const deadEnd = { position: "a.md:0:0", deadEndQuery: "hello " };
	assert.equal(isDismissed(deadEnd, "a.md:0:0", "hello world"), true);
	assert.equal(isDismissed(deadEnd, "a.md:0:0", "hello"), false);
});

test("a mention does not open inside a word, before a space, or without a trigger", () => {
	assert.equal(mentionAt("mail me@home", "@"), undefined);
	assert.deepEqual(mentionAt("@", "@"), { start: 0, query: "" });
	assert.equal(mentionAt("meet @ wed", "@"), undefined);
	assert.equal(mentionAt("meet wed", "@"), undefined);
	assert.equal(mentionAt("meet @wed", ""), undefined);
});

test("a mention does not open inside code or frontmatter", () => {
	assert.equal(isInCode(["```js"], "const a = @"), true);
	assert.equal(isInCode(["~~~", "x", "~~~"], "@"), false);
	assert.equal(isInCode([], "see `@wed"), true);
	assert.equal(isInCode([], "see `x` @wed"), false);
	assert.equal(isInCode(["---", "title: a"], "date: @"), true);
	assert.equal(isInCode(["---", "title: a", "---"], "@"), false);
	assert.equal(isInCode(["text", "---"], "@"), false);
});

test("a mention closes when a space follows a query with no interpretation and no completion", () => {
	const rowsFor = (texts: string[]) => (text: string) => texts.includes(text);
	assert.equal(isDeadEnd("hello", rowsFor([])), false);
	assert.equal(isDeadEnd("hello ", rowsFor([])), true);
	assert.equal(isDeadEnd("hello world", rowsFor([])), true);
	assert.equal(isDeadEnd("next ", rowsFor(["next w"])), false);
	assert.equal(isDeadEnd("last wed", rowsFor(["last wed"])), false);
	assert.equal(isDeadEnd("last we", rowsFor(["last we"])), false);
});

test("rows show what they resolve to before acceptance", () => {
	const [row] = buildRows("last wed", context());
	assert.equal(rowLabel(row, now), "Wed 11 Nov → [[2026-11-11]]");
	assert.equal(row.notes[0].path, "2026-11-11.md");
	const [month] = buildRows("last month", context());
	assert.equal(rowLabel(month, now), "October 2026 → [[2026-10]]");
	const [week] = buildRows("next week", context());
	assert.equal(rowLabel(week, now), "Week of Mon 23 Nov → [[2026-W48]]");
	const [year] = buildRows("2027", context());
	assert.equal(rowLabel(year, now), "2027 → [[2027]]");
});

test("rows list the best interpretation, then the others, then completions, each note once", () => {
	const parser = fakeParser(
		{ mar: [interpretation("month", "2026-03-01", "2026-03-31"), interpretation("day", "2026-11-24", "2026-11-24", "es")] },
		{
			mar: [
				{ text: "march", interpretations: [interpretation("month", "2026-03-01", "2026-03-31")] },
				{ text: "martes", interpretations: [interpretation("day", "2026-11-18", "2026-11-18", "es")] },
			],
		},
	);
	const rows = buildRows("mar", context({ parser }));
	assert.deepEqual(
		rows.map((row) => [row.source, row.text, row.language, row.notes[0].name]),
		[
			["interpretation", "mar", "en", "2026-03"],
			["interpretation", "mar", "es", "2026-11-24"],
			["completion", "martes", "es", "2026-11-18"],
		],
	);
});

test("rows keep only the periods mentions allow and Date notes enable", () => {
	const parser = fakeParser({
		q: [
			interpretation("day", "2026-11-17"),
			interpretation("week", "2026-11-16", "2026-11-22"),
			interpretation("quarter", "2026-10-01", "2026-12-31"),
			interpretation("year", "2026-01-01", "2026-12-31"),
		],
	});
	const mentions = mergeMentions({ periods: { week: false } });
	const rows = buildRows("q", context({ parser, allows: mentionAllows(mentions) }));
	assert.deepEqual(rows.map((row) => row.notes[0].period), ["day", "year"]);
	const dateNotes = defaultDateNotes();
	dateNotes.periods.quarter.enabled = true;
	const withQuarter = buildRows("q", context({ parser, periods: dateNotes.periods, allows: mentionAllows(mentions) }));
	assert.deepEqual(withQuarter.map((row) => row.notes[0].period), ["day", "quarter", "year"]);
});

test("a week that starts on Sunday is named after the ISO week of its weekdays", () => {
	const parser = fakeParser({ q: [interpretation("week", "2026-11-15", "2026-11-21")] });
	const [row] = buildRows("q", context({ parser }));
	assert.equal(row.notes[0].name, "2026-W47");
	assert.equal(row.notes[0].start.format("YYYY-MM-DD"), "2026-11-15");
});

function sequence(unit: Unit, starts: string[]): Interpretation {
	const items = starts.map((start) => ({ unit, start, end: start }));
	return { language: "en", node: { kind: "day", amount: 0, unit: "day" }, result: { kind: "sequence", span: { unit, start: starts[0], end: starts[starts.length - 1] }, items } };
}

test("a range is one row that names every date it inserts", () => {
	const [range] = buildRows("today to fri", context());
	assert.equal(rowLabel(range, now), "Tue 17 → Fri 20 Nov · 4 dates");
	assert.deepEqual(range.notes.map((note) => note.name), ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
	const parser = fakeParser({
		q: [sequence("day", ["2026-11-30", "2026-12-01"]), sequence("week", ["2026-11-23", "2026-11-30"]), interpretation("day", "2026-11-17")],
	});
	const rows = buildRows("q", context({ parser }));
	assert.deepEqual(rows.map((row) => rowLabel(row, now)), [
		"Mon 30 Nov → Tue 1 Dec · 2 dates",
		"Week of Mon 23 Nov → Week of Mon 30 Nov · 2 notes",
		"Tue 17 Nov → [[2026-11-17]]",
	]);
	const withoutWeeks = buildRows("q", context({ parser, allows: (period) => period !== "week" }));
	assert.equal(withoutWeeks.length, 2);
	assert.deepEqual(singleNoteRows(rows).map((row) => row.notes[0].name), ["2026-11-17"]);
});

test("a query may still match while the parser expects more words", () => {
	assert.equal(mayStillMatch("today t", context()), true);
	assert.equal(mayStillMatch("last wed", context()), true);
	assert.equal(mayStillMatch("hello world", context()), false);
	assert.equal(isDeadEnd("today to", (text) => mayStillMatch(text, context())), false);
	assert.equal(isDeadEnd("today to ", (text) => mayStillMatch(text, context())), false);
	assert.equal(isDeadEnd("next ", (text) => mayStillMatch(text, context())), false);
	assert.equal(isDeadEnd("hello ", (text) => mayStillMatch(text, context())), true);
});

test("the locale week start maps to Monday or Sunday for the parser", () => {
	assert.equal(parserWeekStart("locale", 0), "sunday");
	assert.equal(parserWeekStart("locale", 1), "monday");
	assert.equal(parserWeekStart("locale", 6), "monday");
	assert.equal(parserWeekStart("monday", 0), "monday");
	assert.equal(parserWeekStart("sunday", 1), "sunday");
	const settings = defaultSettings();
	settings.languages = ["es", "en"];
	settings.dayMonthOrder = "monthDay";
	assert.deepEqual(parseOptionsOf(settings, 0), { languages: ["es", "en"], weekStart: "sunday", nextWeekday: "nextWeek", dayMonthOrder: "monthDay" });
});

test("plugins that suggest after the same trigger are named", () => {
	const plugins = [
		{ id: "nldates-obsidian", name: "Natural Language Dates", settings: { autocompleteTriggerPhrase: "@", isAutosuggestEnabled: true } },
		{ id: "nldates-revived", name: "NL Dates Revived", settings: { autocompleteTriggerPhrase: "@", isAutosuggestEnabled: false } },
		{ id: "date-list", name: "Date List", settings: { suggestTrigger: "@", listSuggestTrigger: "@@" } },
		{ id: "note-compass", name: "Note Compass", settings: { mention: { enabled: true, trigger: ";;" } } },
		{ id: "other", name: "Other", settings: { trigger: "@" } },
	];
	assert.deepEqual(sameTriggerPlugins("@", plugins), ["Natural Language Dates", "Date List"]);
	assert.deepEqual(sameTriggerPlugins(";;", plugins), ["Note Compass"]);
	assert.deepEqual(sameTriggerPlugins("@@", plugins), ["Date List"]);
	assert.deepEqual(sameTriggerPlugins("@", [{ id: "note-compass", name: "Note Compass", settings: { mention: { enabled: false, trigger: "@" } } }]), []);
	assert.deepEqual(sameTriggerPlugins("@", [{ id: "nldates-obsidian", name: "NLD", settings: {} }]), ["NLD"]);
});

test("mention settings merge with defaults", () => {
	const periods: Record<Period, boolean> = { day: true, week: true, month: true, quarter: true, year: true };
	assert.deepEqual(mergeMentions(undefined), { enabled: true, trigger: "@", periods });
	assert.deepEqual(mergeMentions({ enabled: false, trigger: " ; ; ", periods: { year: false } }), {
		enabled: false,
		trigger: ";;",
		periods: { ...periods, year: false },
	});
});

test("labels name the year when it is not the current one", () => {
	const parser = fakeParser({
		q: [
			interpretation("day", "2027-01-05"),
			interpretation("quarter", "2027-01-01", "2027-03-31"),
			sequence("day", ["2026-12-31", "2027-01-01"]),
		],
	});
	const dateNotes = defaultDateNotes();
	dateNotes.periods.quarter.enabled = true;
	assert.deepEqual(buildRows("q", context({ parser, periods: dateNotes.periods })).map((row) => rowLabel(row, now)), [
		"Tue 5 Jan 2027 → [[2027-01-05]]",
		"Q1 2027 → [[2027-Q1]]",
		"Thu 31 Dec → Fri 1 Jan 2027 · 2 dates",
	]);
});

test("a link to a note that does not exist yet names its path, base name and extension", () => {
	assert.deepEqual({ ...unsavedFile("Daily/2026-11-11.md") }, { path: "Daily/2026-11-11.md", name: "2026-11-11.md", basename: "2026-11-11", extension: "md" });
	assert.deepEqual({ ...unsavedFile("2026") }, { path: "2026", name: "2026", basename: "2026", extension: "" });
});

test("stored triggers fall back to the default when empty, and plugins without settings use their own default", () => {
	assert.equal(mergeMentions({ trigger: "  " }).trigger, "@");
	assert.deepEqual(sameTriggerPlugins("@", [{ id: "date-list", name: "Date List", settings: undefined }]), ["Date List"]);
	assert.deepEqual(sameTriggerPlugins("", [{ id: "date-list", name: "Date List", settings: undefined }]), []);
});
