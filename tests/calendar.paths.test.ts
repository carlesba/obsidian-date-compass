import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isoDate } from "../src/parse/calendar.ts";
import type { CivilDate } from "../src/parse/calendar.ts";
import { monthGrid } from "../src/calendar/grid.ts";
import { activeNoteTouchesVisible, touchesVisible, visibleNotes } from "../src/calendar/paths.ts";
import { ISO_WEEK_RULE, SUNDAY_WEEK_RULE } from "../src/calendar/weeks.ts";
import type { WeekRule } from "../src/calendar/weeks.ts";
import { notePath } from "../src/dateNotes/paths.ts";
import { dateNotesWithoutQuarter } from "./fixtures.ts";
import type { PeriodSettingsByPeriod } from "../src/dateNotes/periods.ts";
import { moment } from "./moment.ts";

function periods(change: (periods: PeriodSettingsByPeriod) => void = () => {}): PeriodSettingsByPeriod {
	const settings = dateNotesWithoutQuarter().periods;
	settings.quarter.enabled = true;
	change(settings);
	return settings;
}

const toMoment = (date: CivilDate) => moment(isoDate(date), "YYYY-MM-DD", true);

const NOVEMBER_2026 = { year: 2026, month: 11 };

test("every cell of the month resolves to its note path: 42 days, 6 weeks, month, quarter and year", () => {
	const notes = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), periods(), toMoment);
	assert.equal(notes.rows.length, 6);
	assert.deepEqual(notes.rows[0].days, ["2026-10-26.md", "2026-10-27.md", "2026-10-28.md", "2026-10-29.md", "2026-10-30.md", "2026-10-31.md", "2026-11-01.md"]);
	assert.deepEqual(notes.rows.map((row) => row.week), ["2026-W44.md", "2026-W45.md", "2026-W46.md", "2026-W47.md", "2026-W48.md", "2026-W49.md"]);
	assert.deepEqual(notes.header, { month: "2026-11.md", quarter: "2026-Q4.md", year: "2026.md" });
	assert.equal(notes.visiblePaths.size, 51);
	assert.ok(notes.visiblePaths.has("2026-11-17.md"));
	assert.ok(notes.visiblePaths.has("2026-W47.md"));
	assert.ok(notes.visiblePaths.has("2026-Q4.md"));
});

test("folders and nested formats carry through to the visible paths", () => {
	const nested = periods((settings) => {
		settings.day.folder = "journal/daily";
		settings.day.format = "YYYY/MM/YYYY-MM-DD";
		settings.week.folder = "journal/weekly";
	});
	const notes = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), nested, toMoment);
	assert.equal(notes.rows[3].days[1], "journal/daily/2026/11/2026-11-17.md");
	assert.equal(notes.rows[3].week, "journal/weekly/2026-W47.md");
});

test("a disabled period has no paths in the cells or in the visible set", () => {
	const onlyWeeks = periods((settings) => {
		settings.day.enabled = false;
		settings.month.enabled = false;
		settings.quarter.enabled = false;
		settings.year.enabled = false;
	});
	const notes = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), onlyWeeks, toMoment);
	assert.ok(notes.rows.every((row) => row.days.every((path) => path === undefined)));
	assert.deepEqual(notes.header, { month: undefined, quarter: undefined, year: undefined });
	assert.deepEqual([...notes.visiblePaths], ["2026-W44.md", "2026-W45.md", "2026-W46.md", "2026-W47.md", "2026-W48.md", "2026-W49.md"]);
	const noWeeks = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), periods((settings) => (settings.week.enabled = false)), toMoment);
	assert.ok(noWeeks.rows.every((row) => row.week === undefined));
	assert.equal(noWeeks.visiblePaths.size, 45);
});

function weekNotesOf(month: { year: number; month: number }, rule: WeekRule, weekFormat: string): (string | undefined)[] {
	const grid = monthGrid(month, rule);
	return visibleNotes(grid, periods((settings) => (settings.week.format = weekFormat)), toMoment).rows.map((row) => row.week);
}

function weekNotesOfDays(month: { year: number; month: number }, rule: WeekRule, weekFormat: string, columns: number[]): string[][] {
	const weekOnly = periods((settings) => (settings.week.format = weekFormat));
	return monthGrid(month, rule).rows.map((row) => [...new Set(columns.map((column) => notePath(toMoment(row.days[column].date), "week", weekOnly)))]);
}

const EVERY_COLUMN = [0, 1, 2, 3, 4, 5, 6];
const MONDAY_TO_SATURDAY_OF_A_SUNDAY_ROW = [1, 2, 3, 4, 5, 6];
const SUNDAY_TO_SATURDAY_OF_A_MONDAY_ROW = [0, 1, 2, 3, 4, 5];
const YEAR_BOUNDARY_MONTHS = [
	{ year: 2026, month: 12 },
	{ year: 2027, month: 1 },
	{ year: 2024, month: 12 },
	{ year: 2025, month: 1 },
];

test("a Monday-first row with an ISO week format opens the ISO week of all its days", () => {
	assert.deepEqual(weekNotesOf(NOVEMBER_2026, ISO_WEEK_RULE, "GGGG-[W]WW"), ["2026-W44.md", "2026-W45.md", "2026-W46.md", "2026-W47.md", "2026-W48.md", "2026-W49.md"]);
	for (const month of [NOVEMBER_2026, ...YEAR_BOUNDARY_MONTHS]) {
		assert.deepEqual(weekNotesOf(month, ISO_WEEK_RULE, "GGGG-[W]WW").map((path) => [path]), weekNotesOfDays(month, ISO_WEEK_RULE, "GGGG-[W]WW", EVERY_COLUMN));
	}
});

test("a Sunday-first row with an ISO week format opens the ISO week of its Monday to Saturday", () => {
	const grid = monthGrid(NOVEMBER_2026, SUNDAY_WEEK_RULE);
	assert.equal(isoDate(grid.rows[2].days[0].date), "2026-11-15");
	assert.equal(weekNotesOf(NOVEMBER_2026, SUNDAY_WEEK_RULE, "GGGG-[W]WW")[2], "2026-W47.md");
	for (const month of [NOVEMBER_2026, ...YEAR_BOUNDARY_MONTHS]) {
		assert.deepEqual(
			weekNotesOf(month, SUNDAY_WEEK_RULE, "GGGG-[W]WW").map((path) => [path]),
			weekNotesOfDays(month, SUNDAY_WEEK_RULE, "GGGG-[W]WW", MONDAY_TO_SATURDAY_OF_A_SUNDAY_ROW),
		);
	}
});

test("a Monday-first row with a Sunday-first locale week format opens the locale week of its Monday to Saturday", () => {
	for (const month of [NOVEMBER_2026, ...YEAR_BOUNDARY_MONTHS]) {
		assert.deepEqual(
			weekNotesOf(month, ISO_WEEK_RULE, "gggg-[W]ww").map((path) => [path]),
			weekNotesOfDays(month, ISO_WEEK_RULE, "gggg-[W]ww", SUNDAY_TO_SATURDAY_OF_A_MONDAY_ROW),
		);
	}
});

test("rows across the year boundary open the weekly note of the right week year", () => {
	assert.deepEqual(weekNotesOf({ year: 2026, month: 12 }, ISO_WEEK_RULE, "GGGG-[W]WW").slice(3), ["2026-W52.md", "2026-W53.md", "2027-W01.md"]);
	assert.deepEqual(weekNotesOf({ year: 2027, month: 1 }, SUNDAY_WEEK_RULE, "GGGG-[W]WW").slice(0, 2), ["2026-W53.md", "2027-W01.md"]);
	assert.deepEqual(weekNotesOf({ year: 2024, month: 12 }, ISO_WEEK_RULE, "GGGG-[W]WW").slice(4), ["2024-W52.md", "2025-W01.md"]);
	assert.deepEqual(weekNotesOf({ year: 2025, month: 1 }, SUNDAY_WEEK_RULE, "GGGG-[W]WW").slice(0, 2), ["2025-W01.md", "2025-W02.md"]);
});

test("the header notes of January belong to the displayed year, not to the days of the previous one", () => {
	const notes = visibleNotes(monthGrid({ year: 2027, month: 1 }, ISO_WEEK_RULE), periods(), toMoment);
	assert.equal(notes.rows[0].days[0], "2026-12-28.md");
	assert.equal(notes.rows[0].week, "2026-W53.md");
	assert.deepEqual(notes.header, { month: "2027-01.md", quarter: "2027-Q1.md", year: "2027.md" });
});

test("a vault event touches the calendar only when its path, or the path it was renamed from, is visible", () => {
	const { visiblePaths } = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), periods(), toMoment);
	assert.equal(touchesVisible(visiblePaths, "2026-11-17.md"), true);
	assert.equal(touchesVisible(visiblePaths, "2026-W47.md"), true);
	assert.equal(touchesVisible(visiblePaths, "2026.md"), true);
	assert.equal(touchesVisible(visiblePaths, "Meeting notes.md"), false);
	assert.equal(touchesVisible(visiblePaths, "2027-03-01.md"), false);
	assert.equal(touchesVisible(visiblePaths, "archive/2026-11-17.md"), false);
	assert.equal(touchesVisible(visiblePaths, "archive/2026-11-17.md", "2026-11-17.md"), true);
	assert.equal(touchesVisible(visiblePaths, "2026-11-17.md", "Untitled.md"), true);
	assert.equal(touchesVisible(visiblePaths, "Renamed.md", "Untitled.md"), false);
});

test("a change of active note touches the calendar only when the note left or the note entered is visible", () => {
	const { visiblePaths } = visibleNotes(monthGrid(NOVEMBER_2026, ISO_WEEK_RULE), periods(), toMoment);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "2026-11-17.md", "Meeting notes.md"), true);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "Meeting notes.md", "2026-11-17.md"), true);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "2026-11-18.md", "2026-11-17.md"), true);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "2026-11-17.md", undefined), true);
	assert.equal(activeNoteTouchesVisible(visiblePaths, undefined, "2026-W47.md"), true);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "2026-11-17.md", "2026-11-17.md"), false);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "Meeting notes.md", "Ideas.md"), false);
	assert.equal(activeNoteTouchesVisible(visiblePaths, "Meeting notes.md", undefined), false);
	assert.equal(activeNoteTouchesVisible(visiblePaths, undefined, "2027-03-01.md"), false);
	assert.equal(activeNoteTouchesVisible(visiblePaths, undefined, undefined), false);
});
