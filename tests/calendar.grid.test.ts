import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isoDate } from "../src/parse/calendar.ts";
import { monthGrid, weekdayOrder } from "../src/calendar/grid.ts";
import { ISO_WEEK_RULE, SUNDAY_WEEK_RULE } from "../src/calendar/weeks.ts";
import type { WeekRule } from "../src/calendar/weeks.ts";

const SATURDAY_LOCALE: WeekRule = { firstDayOfWeek: 6, firstDayOfYear: 12 };

const NOVEMBER_2026 = { year: 2026, month: 11 };

test("a month is always 6 rows of 7 consecutive days", () => {
	for (const month of [NOVEMBER_2026, { year: 2026, month: 2 }, { year: 2015, month: 2 }, { year: 2024, month: 12 }]) {
		for (const rule of [ISO_WEEK_RULE, SUNDAY_WEEK_RULE, SATURDAY_LOCALE]) {
			const grid = monthGrid(month, rule);
			assert.equal(grid.rows.length, 6);
			const days = grid.rows.flatMap((row) => row.days);
			assert.equal(days.length, 42);
			assert.ok(grid.rows.every((row) => row.days.length === 7));
			const epochDays = days.map(({ date }) => Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
			assert.ok(epochDays.every((epochDay, index) => index === 0 || epochDay === epochDays[index - 1] + 1));
			assert.deepEqual(grid.month, month);
		}
	}
});

test("the first column is the week start: Monday, Sunday or the locale's Saturday", () => {
	const firstColumn = (rule: WeekRule) => monthGrid(NOVEMBER_2026, rule).rows.map((row) => isoDate(row.days[0].date));
	assert.deepEqual(firstColumn(ISO_WEEK_RULE), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
	assert.deepEqual(firstColumn(SUNDAY_WEEK_RULE), ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06"]);
	assert.deepEqual(firstColumn(SATURDAY_LOCALE), ["2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28", "2026-12-05"]);
});

test("days outside the displayed month are flagged as adjacent", () => {
	const days = monthGrid(NOVEMBER_2026, ISO_WEEK_RULE).rows.flatMap((row) => row.days);
	assert.deepEqual(days.filter((day) => day.adjacentMonth).map((day) => isoDate(day.date)), [
		"2026-10-26",
		"2026-10-27",
		"2026-10-28",
		"2026-10-29",
		"2026-10-30",
		"2026-10-31",
		"2026-12-01",
		"2026-12-02",
		"2026-12-03",
		"2026-12-04",
		"2026-12-05",
		"2026-12-06",
	]);
	assert.equal(days.filter((day) => !day.adjacentMonth).length, 30);
});

test("a February that fits four weeks still gets six rows, the last two in March", () => {
	const grid = monthGrid({ year: 2026, month: 2 }, SUNDAY_WEEK_RULE);
	assert.equal(isoDate(grid.rows[0].days[0].date), "2026-02-01");
	assert.ok(grid.rows[4].days.every((day) => day.adjacentMonth));
	assert.ok(grid.rows[5].days.every((day) => day.adjacentMonth));
});

test("only today's cell is flagged, and none without a today", () => {
	const flagged = (today?: { year: number; month: number; day: number }) =>
		monthGrid(NOVEMBER_2026, ISO_WEEK_RULE, today)
			.rows.flatMap((row) => row.days)
			.filter((day) => day.today)
			.map((day) => isoDate(day.date));
	assert.deepEqual(flagged({ year: 2026, month: 11, day: 17 }), ["2026-11-17"]);
	assert.deepEqual(flagged({ year: 2026, month: 12, day: 2 }), ["2026-12-02"]);
	assert.deepEqual(flagged({ year: 2027, month: 3, day: 1 }), []);
	assert.deepEqual(flagged(), []);
});

test("each row carries its week number under the week rule, across the year boundary", () => {
	const weekNumbers = (month: { year: number; month: number }, rule: WeekRule) => monthGrid(month, rule).rows.map((row) => row.weekNumber);
	assert.deepEqual(weekNumbers(NOVEMBER_2026, ISO_WEEK_RULE), [44, 45, 46, 47, 48, 49]);
	assert.deepEqual(weekNumbers(NOVEMBER_2026, SUNDAY_WEEK_RULE), [45, 46, 47, 48, 49, 50]);
	assert.deepEqual(weekNumbers({ year: 2026, month: 12 }, ISO_WEEK_RULE), [49, 50, 51, 52, 53, 1]);
	assert.deepEqual(weekNumbers({ year: 2027, month: 1 }, ISO_WEEK_RULE), [53, 1, 2, 3, 4, 5]);
	assert.deepEqual(weekNumbers({ year: 2024, month: 1 }, SUNDAY_WEEK_RULE), [1, 2, 3, 4, 5, 6]);
});

test("the weekly note of a row is found from its fourth day, whatever the week start", () => {
	const weekNoteDates = (month: { year: number; month: number }, rule: WeekRule) => monthGrid(month, rule).rows.map((row) => isoDate(row.weekNoteDate));
	assert.deepEqual(weekNoteDates(NOVEMBER_2026, ISO_WEEK_RULE).slice(0, 2), ["2026-10-29", "2026-11-05"]);
	assert.deepEqual(weekNoteDates(NOVEMBER_2026, SUNDAY_WEEK_RULE).slice(0, 2), ["2026-11-04", "2026-11-11"]);
	assert.deepEqual(weekNoteDates(NOVEMBER_2026, SATURDAY_LOCALE).slice(0, 2), ["2026-11-03", "2026-11-10"]);
	for (const rule of [ISO_WEEK_RULE, SUNDAY_WEEK_RULE, SATURDAY_LOCALE]) {
		for (const row of monthGrid({ year: 2026, month: 12 }, rule).rows) assert.deepEqual(row.weekNoteDate, row.days[3].date);
	}
});

test("weekday columns follow the week start, with Saturday and Sunday as the weekend", () => {
	assert.deepEqual(weekdayOrder(ISO_WEEK_RULE).map((column) => column.weekday), [1, 2, 3, 4, 5, 6, 0]);
	assert.deepEqual(weekdayOrder(ISO_WEEK_RULE).map((column) => column.weekend), [false, false, false, false, false, true, true]);
	assert.deepEqual(weekdayOrder(SUNDAY_WEEK_RULE).map((column) => column.weekday), [0, 1, 2, 3, 4, 5, 6]);
	assert.deepEqual(weekdayOrder(SUNDAY_WEEK_RULE).map((column) => column.weekend), [true, false, false, false, false, false, true]);
	assert.deepEqual(weekdayOrder(SATURDAY_LOCALE).map((column) => column.weekday), [6, 0, 1, 2, 3, 4, 5]);
	assert.deepEqual(weekdayOrder(SATURDAY_LOCALE).map((column) => column.weekend), [true, true, false, false, false, false, false]);
});
