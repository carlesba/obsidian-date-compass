import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isoDate } from "../src/parse/calendar.ts";
import { monthGrid, weeksAroundGrid } from "../src/calendar/grid.ts";
import { anchorAfterDayChange, shiftWeek, startOfMonthBefore, startOfNextMonth } from "../src/calendar/navigation.ts";
import { todayRowIndex } from "../src/calendar/settings.ts";
import { ISO_WEEK_RULE } from "../src/calendar/weeks.ts";

const TODAY = { year: 2026, month: 11, day: 27 };
const firstDays = (rows: { days: { date: { year: number; month: number; day: number } }[] }[]) => rows.map((row) => isoDate(row.days[0].date));

test("extra weeks before and after grow the month grid on each side", () => {
	const grid = monthGrid({ year: 2026, month: 11 }, ISO_WEEK_RULE, TODAY, { before: 1, after: 2 });
	assert.deepEqual(firstDays(grid.rows), ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
	assert.equal(grid.rows[0].days[0].adjacentMonth, true);
});

test("the weeks view puts today's week on the chosen row and fades days outside its month", () => {
	assert.deepEqual([todayRowIndex("first", 6), todayRowIndex("middle", 6), todayRowIndex("middle", 5), todayRowIndex("last", 6)], [0, 2, 2, 5]);
	const grid = weeksAroundGrid(TODAY, 6, 1, ISO_WEEK_RULE, TODAY);
	assert.deepEqual(firstDays(grid.rows), ["2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21"]);
	assert.deepEqual(grid.month, { year: 2026, month: 11 });
	assert.deepEqual(grid.rows[2].days.filter((day) => !day.adjacentMonth).map((day) => day.date.day), [30]);
	assert.equal(grid.rows[1].days.find((day) => day.today)?.date.day, 27);
});

test("the single arrows move a week and the double arrows jump to the start of a month", () => {
	assert.deepEqual(shiftWeek(TODAY, 1), { year: 2026, month: 12, day: 4 });
	assert.deepEqual(shiftWeek(TODAY, -1), { year: 2026, month: 11, day: 20 });
	assert.deepEqual(startOfNextMonth(TODAY), { year: 2026, month: 12, day: 1 });
	assert.deepEqual(startOfNextMonth({ year: 2026, month: 12, day: 1 }), { year: 2027, month: 1, day: 1 });
	assert.deepEqual(startOfMonthBefore(TODAY), { year: 2026, month: 11, day: 1 });
	assert.deepEqual(startOfMonthBefore({ year: 2026, month: 11, day: 1 }), { year: 2026, month: 10, day: 1 });
	assert.deepEqual(startOfMonthBefore({ year: 2026, month: 1, day: 1 }), { year: 2025, month: 12, day: 1 });
});

test("the weeks view follows today across midnight only while it shows today", () => {
	const tomorrow = { year: 2026, month: 11, day: 28 };
	assert.deepEqual(anchorAfterDayChange(TODAY, TODAY, tomorrow), tomorrow);
	const browsed = { year: 2027, month: 1, day: 1 };
	assert.deepEqual(anchorAfterDayChange(browsed, TODAY, tomorrow), browsed);
});
