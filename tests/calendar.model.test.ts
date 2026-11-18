import { test } from "node:test";
import { strict as assert } from "node:assert";
import { addDays, isoDate } from "../src/parse/calendar.ts";
import type { CivilDate } from "../src/parse/calendar.ts";
import { monthGrid } from "../src/calendar/grid.ts";
import type { CivilMonth } from "../src/calendar/grid.ts";
import { headerParts } from "../src/calendar/header.ts";
import { calendarModel, dayClasses, dayTime, titlePartClasses, weekClasses, weekTime } from "../src/calendar/model.ts";
import type { CalendarModel } from "../src/calendar/model.ts";
import type { Dot, DotPlace } from "../src/calendar/decorators.ts";
import { visibleNotes } from "../src/calendar/paths.ts";
import { ISO_WEEK_RULE, SUNDAY_WEEK_RULE } from "../src/calendar/weeks.ts";
import type { WeekRule } from "../src/calendar/weeks.ts";
import { dateNotesWithoutQuarter } from "./fixtures.ts";
import type { PeriodSettingsByPeriod } from "../src/dateNotes/periods.ts";
import { moment } from "./moment.ts";

const FILLED: Dot = { decoratorId: "dots-1", source: "words", shape: "filled", color: "default", position: "below" };
const WITHOUT_NOTE: Dot = { ...FILLED, decoratorId: "dots-2", source: "links" };
const NOVEMBER_2026 = { year: 2026, month: 11 };
const TODAY = { year: 2026, month: 11, day: 17 };
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMoment = (date: CivilDate) => moment(isoDate(date), "YYYY-MM-DD", true);

interface Scene {
	month?: CivilMonth;
	rule?: WeekRule;
	showWeekNumbers?: boolean;
	existing?: string[];
	activePath?: string;
	change?: (periods: PeriodSettingsByPeriod) => void;
	dotsOf?: (path: string, place: DotPlace, hasNote: boolean) => Dot[];
}

function modelOf({ month = NOVEMBER_2026, rule = ISO_WEEK_RULE, showWeekNumbers = true, existing = [], activePath, change, dotsOf = (_path, _place, hasNote) => (hasNote ? [FILLED] : []) }: Scene = {}): CalendarModel {
	const periods = dateNotesWithoutQuarter().periods;
	change?.(periods);
	const grid = monthGrid(month, rule, TODAY);
	return calendarModel({
		grid,
		today: TODAY,
		notes: visibleNotes(grid, periods, toMoment),
		parts: headerParts(month, "Nov", periods),
		rule,
		weekdayNames: WEEKDAY_NAMES,
		showWeekNumbers,
		activePath,
		noteExists: (path) => existing.includes(path),
		showsDotsAbove: false,
		dotsOf,
	});
}

function dayOf(model: CalendarModel, row: number, column: number) {
	return model.rows[row].days[column];
}

test("weekday headings follow the week rule and mark the weekend columns", () => {
	assert.deepEqual(modelOf().weekdays.map((heading) => heading.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
	assert.deepEqual(modelOf().weekdays.map((heading) => heading.weekend), [false, false, false, false, false, true, true]);
	const sundayFirst = modelOf({ rule: SUNDAY_WEEK_RULE }).weekdays;
	assert.deepEqual(sundayFirst.map((heading) => heading.label), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
	assert.deepEqual(sundayFirst.map((heading) => heading.weekend), [true, false, false, false, false, false, true]);
});

test("a day carries its number, its note target and the classes of its state", () => {
	const model = modelOf({ existing: ["2026-11-17.md", "2026-10-26.md"], activePath: "2026-11-17.md" });
	const today = dayOf(model, 3, 1);
	assert.equal(today.label, "17");
	assert.deepEqual(today.target, { period: "day", date: TODAY, path: "2026-11-17.md" });
	assert.deepEqual(today.dots, [FILLED]);
	assert.deepEqual(dayClasses(today), ["day", "today", "active", "has-note", "is-clickable"]);
	assert.deepEqual(dayClasses(dayOf(model, 0, 0)), ["day", "adjacent-month", "has-note", "is-clickable"]);
	const plain = dayOf(model, 3, 2);
	assert.deepEqual(dayClasses(plain), ["day", "is-clickable"]);
	assert.deepEqual(plain.dots, []);
});

test("cells without a note ask for the dots that show without one, and say whether they are a day or a week", () => {
	const asked: string[] = [];
	const model = modelOf({
		existing: ["2026-11-17.md"],
		dotsOf: (path, { cell }, hasNote) => {
			asked.push(`${path} ${cell} ${hasNote}`);
			return hasNote ? [FILLED] : [WITHOUT_NOTE];
		},
	});
	assert.deepEqual(dayOf(model, 3, 1).dots, [FILLED]);
	assert.deepEqual(dayOf(model, 3, 2).dots, [WITHOUT_NOTE]);
	assert.deepEqual(model.rows[3].week?.dots, [WITHOUT_NOTE]);
	assert.ok(asked.includes("2026-11-17.md day true"));
	assert.ok(asked.includes("2026-11-18.md day false"));
	assert.ok(asked.includes("2026-W47.md week false"));
	assert.deepEqual(model.title.flatMap((part) => part.dots), []);
});

test("a day is past, current or future compared with today", () => {
	assert.equal(dayTime({ year: 2026, month: 11, day: 16 }, TODAY), "past");
	assert.equal(dayTime(TODAY, TODAY), "current");
	assert.equal(dayTime({ year: 2026, month: 11, day: 18 }, TODAY), "future");
	assert.equal(dayTime({ year: 2025, month: 12, day: 31 }, TODAY), "past");
	assert.equal(dayTime({ year: 2027, month: 1, day: 1 }, TODAY), "future");
});

test("a week is current when it holds today, past when every day is before today and future otherwise", () => {
	const weekFrom = (year: number, month: number, day: number) => Array.from({ length: 7 }, (_, offset) => addDays({ year, month, day }, offset));
	assert.equal(weekTime(weekFrom(2026, 11, 16), TODAY), "current");
	assert.equal(weekTime(weekFrom(2026, 11, 11), TODAY), "current");
	assert.equal(weekTime(weekFrom(2026, 11, 17), TODAY), "current");
	assert.equal(weekTime(weekFrom(2026, 11, 9), TODAY), "past");
	assert.equal(weekTime(weekFrom(2026, 11, 10), TODAY), "past");
	assert.equal(weekTime(weekFrom(2026, 11, 18), TODAY), "future");
	assert.equal(weekTime(weekFrom(2026, 11, 23), TODAY), "future");
	assert.equal(weekTime(weekFrom(2026, 10, 26), { year: 2026, month: 11, day: 1 }), "current");
	assert.equal(weekTime(weekFrom(2026, 10, 26), { year: 2026, month: 11, day: 2 }), "past");
	assert.equal(weekTime(weekFrom(2026, 11, 30), { year: 2026, month: 11, day: 29 }), "future");
	assert.equal(weekTime(weekFrom(2026, 11, 30), { year: 2026, month: 12, day: 6 }), "current");
});

test("every day and week cell asks for its dots with its time", () => {
	const timeOfPath = new Map<string, string>();
	const model = modelOf({
		dotsOf: (path, { cell, time }) => {
			timeOfPath.set(path, `${cell} ${time}`);
			return [];
		},
	});
	assert.deepEqual(model.rows.map((row) => timeOfPath.get(row.week?.target?.path ?? "")), ["week past", "week past", "week past", "week current", "week future", "week future"]);
	assert.deepEqual(model.rows[3].days.map((day) => timeOfPath.get(day.target?.path ?? "")), ["day past", "day current", "day future", "day future", "day future", "day future", "day future"]);
	assert.equal(timeOfPath.get("2026-10-26.md"), "day past");
	assert.equal(timeOfPath.get("2026-12-06.md"), "day future");
	const december = modelOf({
		month: { year: 2026, month: 12 },
		dotsOf: (path, { cell, time }) => {
			timeOfPath.set(path, `${cell} ${time}`);
			return [];
		},
	});
	assert.deepEqual(december.rows.map((row) => timeOfPath.get(row.week?.target?.path ?? "")), ["week future", "week future", "week future", "week future", "week future", "week future"]);
	const october = modelOf({
		month: { year: 2026, month: 10 },
		dotsOf: (path, { cell, time }) => {
			timeOfPath.set(path, `${cell} ${time}`);
			return [];
		},
	});
	assert.deepEqual(october.rows.map((row) => timeOfPath.get(row.week?.target?.path ?? "")), ["week past", "week past", "week past", "week past", "week past", "week past"]);
});

test("days are not clickable when daily notes are off", () => {
	const model = modelOf({ existing: ["2026-11-17.md"], activePath: "2026-11-17.md", change: (periods) => (periods.day.enabled = false) });
	const today = dayOf(model, 3, 1);
	assert.equal(today.target, undefined);
	assert.deepEqual(today.dots, []);
	assert.deepEqual(dayClasses(today), ["day", "today"]);
});

test("the week column shows each row's week number and targets its weekly note", () => {
	const model = modelOf({ existing: ["2026-W47.md"], activePath: "2026-W47.md" });
	assert.equal(model.showsWeekColumn, true);
	assert.deepEqual(model.rows.map((row) => row.week?.label), ["44", "45", "46", "47", "48", "49"]);
	const week = model.rows[3].week;
	assert.ok(week);
	assert.deepEqual(week.target, { period: "week", date: { year: 2026, month: 11, day: 19 }, path: "2026-W47.md" });
	assert.deepEqual(week.dots, [FILLED]);
	assert.deepEqual(weekClasses(week), ["week-num", "active", "has-note", "is-clickable"]);
	const missing = model.rows[0].week;
	assert.ok(missing);
	assert.deepEqual(weekClasses(missing), ["week-num", "is-clickable"]);
});

test("the week column is hidden when week numbers are off", () => {
	const hidden = modelOf({ showWeekNumbers: false });
	assert.equal(hidden.showsWeekColumn, false);
	assert.ok(hidden.rows.every((row) => row.week === undefined));
});

test("week numbers are shown but not clickable when weekly notes are off", () => {
	const model = modelOf({ existing: ["2026-W47.md"], activePath: "2026-W47.md", change: (periods) => (periods.week.enabled = false) });
	assert.equal(model.showsWeekColumn, true);
	assert.deepEqual(model.rows.map((row) => row.week?.label), ["44", "45", "46", "47", "48", "49"]);
	for (const { week } of model.rows) {
		assert.ok(week);
		assert.equal(week.target, undefined);
		assert.equal(week.hasNote, false);
		assert.equal(week.active, false);
		assert.deepEqual(week.dots, []);
		assert.deepEqual(weekClasses(week), ["week-num"]);
	}
});

test("the title shows month and year, and the quarter only when quarterly notes are on", () => {
	assert.deepEqual(modelOf().title.map((part) => part.label), ["Nov", "2026"]);
	const withQuarter = modelOf({ change: (periods) => (periods.quarter.enabled = true) });
	assert.deepEqual(withQuarter.title.map((part) => part.label), ["Nov", "Q4", "2026"]);
	assert.deepEqual(withQuarter.title.map((part) => part.target?.path), ["2026-11.md", "2026-Q4.md", "2026.md"]);
	assert.deepEqual(withQuarter.title[1].target?.date, { year: 2026, month: 11, day: 1 });
});

test("a title part is clickable only when its period is on, and never carries dots", () => {
	const model = modelOf({ existing: ["2026-11.md", "2026.md"], activePath: "2026-11.md", change: (periods) => (periods.year.enabled = false) });
	const [month, year] = model.title;
	assert.deepEqual(titlePartClasses(month), ["month", "active", "has-note", "is-clickable"]);
	assert.deepEqual(month.dots, []);
	assert.equal(year.target, undefined);
	assert.deepEqual(titlePartClasses(year), ["year"]);
});
