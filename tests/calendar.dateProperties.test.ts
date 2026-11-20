import { test } from "node:test";
import { strict as assert } from "node:assert";
import { datePropertyNotes, daysIn, headerRange, isoDateOf, propertyDates } from "../src/calendar/dateProperties.ts";
import { cellDotsOf, decoratorOf, mergeDecorators } from "../src/calendar/decorators.ts";
import type { DotPlace } from "../src/calendar/decorators.ts";
import { defaultSettings } from "../src/settings.ts";
import { decoratorKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { decoratorDescription, decoratorWarning } from "../src/settings/calendarPage.ts";

const DAY: DotPlace = { cell: "day", time: "future" };

test("a date property reads dates, dates with a time and lists of dates, and ignores anything else", () => {
	assert.equal(isoDateOf("2020-12-31"), "2020-12-31");
	assert.equal(isoDateOf("2020-12-31T10:30"), "2020-12-31");
	assert.equal(isoDateOf("2020-02-30"), undefined);
	assert.equal(isoDateOf("[[2020-12-31]]"), undefined);
	assert.equal(isoDateOf(20201231), undefined);
	assert.deepEqual(propertyDates({ Deadline: "2020-12-31" }, "deadline"), ["2020-12-31"]);
	assert.deepEqual(propertyDates({ due: ["2020-12-30", "soon", "2020-12-31", "2020-12-31"] }, "due"), ["2020-12-30", "2020-12-31"]);
	assert.deepEqual(propertyDates({ due: "2020-12-31" }, "deadline"), []);
	assert.deepEqual(propertyDates(undefined, "deadline"), []);
});

test("a range covers every day of its month, quarter or year", () => {
	assert.deepEqual(headerRange("month", { year: 2024, month: 2 }), { start: { year: 2024, month: 2, day: 1 }, end: { year: 2024, month: 2, day: 29 } });
	assert.deepEqual(headerRange("quarter", { year: 2020, month: 11 }), { start: { year: 2020, month: 10, day: 1 }, end: { year: 2020, month: 12, day: 31 } });
	assert.deepEqual(headerRange("year", { year: 2020, month: 5 }), { start: { year: 2020, month: 1, day: 1 }, end: { year: 2020, month: 12, day: 31 } });
	assert.equal(daysIn(headerRange("year", { year: 2020, month: 1 })).length, 366);
});

test("notes are found by the dates their property holds and follow edits, renames and deletions", () => {
	const frontmatter = new Map<string, Record<string, unknown>>([
		["foo.md", { deadline: "2020-12-31" }],
		["bar.md", { deadline: ["2020-12-28", "2020-12-31"] }],
		["baz.md", { due: "2020-12-31" }],
	]);
	const notes = datePropertyNotes(
		() => [...frontmatter.keys()],
		(path) => frontmatter.get(path),
	);
	const lastDay = { start: { year: 2020, month: 12, day: 31 }, end: { year: 2020, month: 12, day: 31 } };
	const lastWeek = { start: { year: 2020, month: 12, day: 28 }, end: { year: 2021, month: 1, day: 3 } };
	assert.deepEqual(notes.notesIn("deadline", lastDay).sort(), ["bar.md", "foo.md"]);
	assert.deepEqual(notes.notesIn("deadline", lastWeek).sort(), ["bar.md", "foo.md"]);
	assert.deepEqual(notes.notesIn("", lastDay), []);
	frontmatter.set("foo.md", { deadline: "2021-01-02" });
	notes.noteChanged("foo.md");
	assert.deepEqual(notes.notesIn("deadline", lastDay), ["bar.md"]);
	frontmatter.set("moved.md", frontmatter.get("bar.md") ?? {});
	frontmatter.delete("bar.md");
	notes.noteChanged("moved.md", "bar.md");
	assert.deepEqual(notes.notesIn("deadline", lastDay), ["moved.md"]);
	frontmatter.delete("moved.md");
	notes.noteChanged("moved.md");
	assert.deepEqual(notes.notesIn("deadline", lastDay), []);
});

test("dots from notes list the notes behind them, and a date without a note still shows them", () => {
	const dated = { ...decoratorOf("dateProperty", "dots-1"), dateProperty: "deadline" };
	const words = decoratorOf("words", "dots-2");
	const { dots, references } = cellDotsOf([dated, words], DAY, false, (decorator) => (decorator.source === "dateProperty" ? ["foo.md", "bar.md"] : 0));
	assert.deepEqual(dots.map((dot) => dot.decoratorId), ["dots-1"]);
	assert.deepEqual(references.map((reference) => [reference.dot.decoratorId, reference.notePath]), [["dots-1", "foo.md"], ["dots-1", "bar.md"]]);
	assert.deepEqual(cellDotsOf([dated], DAY, false, () => []).references, []);
});

test("a stored date property entry keeps its property and filter", () => {
	const [stored] = mergeDecorators([{ id: "dots-1", source: "dateProperty", dateProperty: " deadline ", filter: { mode: "all", items: [] } }], undefined);
	assert.equal(stored.source, "dateProperty");
	assert.equal(stored.dateProperty, "deadline");
	assert.equal(stored.showWithoutNote, true);
	const [words] = mergeDecorators([{ id: "dots-1", source: "words", dateProperty: "deadline" }], undefined);
	assert.equal(words.dateProperty, "");
});

test("the property control writes only on date property dots, and the row names the property or warns", () => {
	const settings = defaultSettings();
	settings.calendar.decorators.push(decoratorOf("dateProperty", "dots-dated"));
	const key = decoratorKey("dots-dated", "dateProperty");
	assert.equal(readControl(settings, key), "");
	assert.equal(writeControl(settings, key, "deadline"), true);
	assert.equal(readControl(settings, key), "deadline");
	assert.equal(writeControl(settings, decoratorKey(settings.calendar.decorators[0].id, "dateProperty"), "deadline"), false);
	const [, , dated] = settings.calendar.decorators;
	assert.equal(decoratorDescription(dated), "deadline");
	assert.equal(decoratorDescription({ ...dated, dateProperty: "" }), "no property chosen");
	assert.equal(decoratorWarning({ ...dated, dateProperty: "" }, {}), "Choose the date property these dots read.");
	assert.equal(decoratorWarning(dated, {}), undefined);
	assert.equal(decoratorWarning(dated, { deadline: "date" }), undefined);
	assert.equal(decoratorWarning({ ...dated, dateProperty: "dealine" }, { deadline: "date" }), "No note has a property named dealine. Check the spelling.");
	assert.equal(writeControl(settings, decoratorKey("dots-dated", "source"), "words"), true);
	assert.equal(settings.calendar.decorators[2].dateProperty, "");
});
