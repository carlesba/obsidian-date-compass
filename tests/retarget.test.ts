import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Period } from "../src/dateNotes/periods.ts";
import { parse } from "../src/parse/index.ts";
import type { ParseOptions, Span } from "../src/parse/index.ts";
import { civilOf } from "../src/parse/calendar.ts";
import { collapseRepeats, retargetSpan, retargetSpans, spanKey } from "../src/mentions/retarget.ts";

const MONDAY: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };
const SUNDAY: ParseOptions = { ...MONDAY, weekStart: "sunday" };

const FRIDAY_13_FEB_2026 = new Date(2026, 1, 13, 12);

function spansOf(phrase: string, now: Date, options: ParseOptions): Span[] {
	const [first] = parse(phrase, now, options);
	assert.ok(first, `"${phrase}" should parse`);
	return first.result.kind === "sequence" ? first.result.items : [first.result.span];
}

function retargeted(phrase: string, targets: Period[], now = FRIDAY_13_FEB_2026, options = MONDAY): string | undefined {
	const [span] = spansOf(phrase, now, options);
	const result = retargetSpan(span, civilOf(now), options, targets);
	return result && `${result.unit} ${result.start}..${result.end}`;
}

test("a phrase whose period is targeted stays as it is", () => {
	const [span] = spansOf("next month", FRIDAY_13_FEB_2026, MONDAY);
	assert.equal(retargetSpan(span, civilOf(FRIDAY_13_FEB_2026), MONDAY, ["day", "month"]), span);
	assert.equal(retargeted("tomorrow", ["day"]), "day 2026-02-14..2026-02-14");
	assert.equal(retargeted("next quarter", ["year", "quarter"]), "quarter 2026-04-01..2026-06-30");
});

test("without targets a phrase gives nothing", () => {
	assert.equal(retargeted("tomorrow", []), undefined);
	assert.equal(retargetSpans(spansOf("mon to wed", FRIDAY_13_FEB_2026, MONDAY), civilOf(FRIDAY_13_FEB_2026), MONDAY, []), undefined);
});

test("a phrase finer than a target becomes the finest coarser target that contains it", () => {
	assert.equal(retargeted("tomorrow", ["month"]), "month 2026-02-01..2026-02-28");
	assert.equal(retargeted("tomorrow", ["year", "quarter"]), "quarter 2026-01-01..2026-03-31");
	assert.equal(retargeted("next month", ["year", "quarter"]), "quarter 2026-01-01..2026-03-31");
	assert.equal(retargeted("next quarter", ["year"]), "year 2026-01-01..2026-12-31");
});

test("a coarser target wins over shifting today into a finer one", () => {
	assert.equal(retargeted("next month", ["day", "year"]), "year 2026-01-01..2026-12-31");
});

test("a phrase coarser than every target shifts today by as many of its periods", () => {
	assert.equal(retargeted("next month", ["day"]), "day 2026-03-13..2026-03-13");
	assert.equal(retargeted("last month", ["day"]), "day 2026-01-13..2026-01-13");
	assert.equal(retargeted("this month", ["day"]), "day 2026-02-13..2026-02-13");
	assert.equal(retargeted("next week", ["day"]), "day 2026-02-20..2026-02-20");
	assert.equal(retargeted("next year", ["day"]), "day 2027-02-13..2027-02-13");
	assert.equal(retargeted("next quarter", ["day"]), "day 2026-05-13..2026-05-13");
});

test("a shift by months keeps the day when the month has it and its last day otherwise", () => {
	assert.equal(retargeted("next month", ["day"], new Date(2026, 0, 31, 12)), "day 2026-02-28..2026-02-28");
	assert.equal(retargeted("next month", ["day"], new Date(2024, 0, 31, 12)), "day 2024-02-29..2024-02-29");
});

test("a phrase coarser than every target lands in the coarsest one", () => {
	assert.equal(retargeted("next quarter", ["week", "month"]), "month 2026-05-01..2026-05-31");
	assert.equal(retargeted("next quarter", ["month"]), "month 2026-05-01..2026-05-31");
	assert.equal(retargeted("next month", ["day", "week"]), "week 2026-03-09..2026-03-15");
	assert.equal(retargeted("next month", ["week", "day"]), "week 2026-03-09..2026-03-15");
});

test("weeks follow the first day of the week", () => {
	assert.equal(retargeted("next month", ["day", "week"], FRIDAY_13_FEB_2026, SUNDAY), "week 2026-03-08..2026-03-14");
	assert.equal(retargeted("next week", ["day"], FRIDAY_13_FEB_2026, SUNDAY), "day 2026-02-20..2026-02-20");
	const sunday = new Date(2026, 1, 15, 12);
	assert.equal(retargeted("today", ["week"], sunday, MONDAY), "week 2026-02-09..2026-02-15");
	assert.equal(retargeted("today", ["week"], sunday, SUNDAY), "week 2026-02-15..2026-02-21");
	assert.equal(retargeted("next week", ["day"], sunday, MONDAY), "day 2026-02-22..2026-02-22");
	assert.equal(retargeted("next week", ["day"], sunday, SUNDAY), "day 2026-02-22..2026-02-22");
	assert.equal(retargeted("last week", ["day"], sunday, MONDAY), "day 2026-02-08..2026-02-08");
});

test("a week becomes the month of the date that names it", () => {
	const today = { year: 2026, month: 2, day: 13 };
	const week = (start: string, end: string): Span => ({ unit: "week", start, end });
	assert.deepEqual(retargetSpan(week("2026-06-29", "2026-07-05"), today, MONDAY, ["month"]), { unit: "month", start: "2026-07-01", end: "2026-07-31" });
	assert.deepEqual(retargetSpan(week("2026-06-28", "2026-07-04"), today, SUNDAY, ["month"]), { unit: "month", start: "2026-07-01", end: "2026-07-31" });
	assert.deepEqual(retargetSpan(week("2026-06-22", "2026-06-28"), today, MONDAY, ["month"]), { unit: "month", start: "2026-06-01", end: "2026-06-30" });
	assert.deepEqual(retargetSpan(week("2025-12-29", "2026-01-04"), today, MONDAY, ["year", "quarter"]), { unit: "quarter", start: "2026-01-01", end: "2026-03-31" });
});

test("a span without a real date gives nothing", () => {
	const today = { year: 2026, month: 2, day: 13 };
	assert.equal(retargetSpan({ unit: "month", start: "2026-02-30", end: "2026-02-30" }, today, MONDAY, ["day"]), undefined);
	assert.equal(retargetSpan({ unit: "month", start: "soon", end: "soon" }, today, MONDAY, ["day"]), undefined);
});

test("a sequence is retargeted item by item and repeated neighbours collapse", () => {
	const today = civilOf(FRIDAY_13_FEB_2026);
	const days = spansOf("26 feb to 2 mar", FRIDAY_13_FEB_2026, MONDAY);
	assert.equal(days.length, 5);
	assert.deepEqual(retargetSpans(days, today, MONDAY, ["month"])?.map(spanKey), ["month:2026-02-01", "month:2026-03-01"]);
	assert.deepEqual(retargetSpans(days, today, MONDAY, ["day", "month"])?.map(spanKey), days.map(spanKey));
	assert.deepEqual(retargetSpans(days, today, MONDAY, ["week"])?.map(spanKey), ["week:2026-02-23", "week:2026-03-02"]);
});

test("only consecutive repeats collapse", () => {
	assert.deepEqual(collapseRepeats(["a", "a", "b", "a", "a", "a"], (item) => item), ["a", "b", "a"]);
	assert.deepEqual(collapseRepeats([], (item: string) => item), []);
	assert.deepEqual(collapseRepeats([{ path: "x" }, { path: "x" }, { path: "y" }], (note) => note.path), [{ path: "x" }, { path: "y" }]);
});
