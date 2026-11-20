import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isoDate } from "../src/parse/calendar.ts";
import type { CivilDate } from "../src/parse/calendar.ts";
import { dayRange } from "../src/calendar/dateProperties.ts";
import type { DateRange } from "../src/calendar/dateProperties.ts";
import type { Dot, DotPlace, DotReference } from "../src/calendar/decorators.ts";
import { monthGrid, weeksAroundGrid } from "../src/calendar/grid.ts";
import type { MonthGrid } from "../src/calendar/grid.ts";
import { headerParts } from "../src/calendar/header.ts";
import { calendarModel } from "../src/calendar/model.ts";
import type { CalendarModel } from "../src/calendar/model.ts";
import { visibleNotes } from "../src/calendar/paths.ts";
import { referenceRows, selectedCellUse, selectedRange, visibleCellUse, weeksCovering } from "../src/calendar/references.ts";
import type { ReferenceSources, SelectedDateNote } from "../src/calendar/references.ts";
import { ISO_WEEK_RULE } from "../src/calendar/weeks.ts";
import { dateNotesWithoutQuarter } from "./fixtures.ts";
import { moment } from "./moment.ts";

const TODAY = { year: 2020, month: 12, day: 15 };
const DATED: Dot = { decoratorId: "dots-dated", source: "dateProperty", shape: "filled", color: "red", position: "below" };
const LINKED: Dot = { decoratorId: "dots-links", source: "links", shape: "filled", color: "accent", position: "below" };
const ORDER = ["dots-links", "dots-dated"];
const toMoment = (date: CivilDate) => moment(isoDate(date), "YYYY-MM-DD", true);
const periods = dateNotesWithoutQuarter().periods;

const deadlines: Record<string, string[]> = { "2020-12-31": ["Tax filing.md", "Project foo.md"], "2020-12-01": ["Kickoff.md"], "2021-01-02": ["Later.md"] };
const links: Record<string, string[]> = { "2020-12-31.md": ["Meeting.md"], "2020-W53.md": ["Retro.md"] };

function within(range: DateRange, iso: string): boolean {
	return iso >= isoDate(range.start) && iso <= isoDate(range.end);
}

function modelsOf(grid: MonthGrid): CalendarModel[] {
	return [
		calendarModel({
			grid,
			today: TODAY,
			notes: visibleNotes(grid, periods, toMoment),
			parts: headerParts(grid.month, "Dec", periods),
			rule: ISO_WEEK_RULE,
			weekdayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
			showWeekNumbers: true,
			activePath: undefined,
			noteExists: () => false,
			showsDotsAbove: false,
			dotsOf: (path: string, place: DotPlace, _hasNote: boolean, days: DateRange) => {
				const references: DotReference[] = [];
				if (place.cell === "day" || place.cell === "week" || place.cell === "month") {
					for (const [iso, notes] of Object.entries(deadlines)) if (within(days, iso)) for (const notePath of notes) references.push({ dot: DATED, notePath });
				}
				for (const notePath of links[path] ?? []) references.push({ dot: LINKED, notePath });
				return { dots: [...new Set(references.map((reference) => reference.dot))], references };
			},
		}),
	];
}

const name = (path: string) => path.replace(/\.md$/, "");
const rowsOf = (models: CalendarModel[], use: Parameters<typeof referenceRows>[1], sources: ReferenceSources) =>
	referenceRows(models, use, sources, ORDER, name).map((row) => `${row.label} ${row.dot.decoratorId} ${name(row.notePath)}`);

test("the visible dates list each dated note once on its day, sorted by date, entry and name", () => {
	const models = modelsOf(monthGrid({ year: 2020, month: 12 }, ISO_WEEK_RULE, TODAY));
	assert.deepEqual(rowsOf(models, visibleCellUse, "dateProperties"), ["1 dots-dated Kickoff", "31 dots-dated Project foo", "31 dots-dated Tax filing", "2 dots-dated Later"]);
});

test("listing linking notes too adds them on the cell of the note they link to", () => {
	const models = modelsOf(monthGrid({ year: 2020, month: 12 }, ISO_WEEK_RULE, TODAY));
	assert.deepEqual(rowsOf(models, visibleCellUse, "all"), [
		"1 dots-dated Kickoff",
		"53 dots-links Retro",
		"31 dots-links Meeting",
		"31 dots-dated Project foo",
		"31 dots-dated Tax filing",
		"2 dots-dated Later",
	]);
});

function selectedRows(selected: SelectedDateNote, sources: ReferenceSources): string[] {
	const range = selectedRange(selected, ISO_WEEK_RULE);
	const grid = weeksAroundGrid(range.start, weeksCovering(range, ISO_WEEK_RULE), 0, ISO_WEEK_RULE, TODAY);
	return rowsOf(modelsOf(grid), selectedCellUse(selected, range), sources);
}

test("a selected day lists only that day, and a selected week its own links and every day inside it", () => {
	const lastDay: SelectedDateNote = { period: "day", date: { year: 2020, month: 12, day: 31 }, path: "2020-12-31.md" };
	assert.deepEqual(selectedRows(lastDay, "all"), ["31 dots-links Meeting", "31 dots-dated Project foo", "31 dots-dated Tax filing"]);
	const lastWeek: SelectedDateNote = { period: "week", date: { year: 2020, month: 12, day: 28 }, path: "2020-W53.md" };
	assert.deepEqual(selectedRows(lastWeek, "dateProperties"), ["31 dots-dated Project foo", "31 dots-dated Tax filing", "2 dots-dated Later"]);
	assert.deepEqual(selectedRows(lastWeek, "all")[0], "53 dots-links Retro");
});

test("a selected month covers its days only, not the days of the weeks around it", () => {
	const december: SelectedDateNote = { period: "month", date: { year: 2020, month: 12, day: 1 }, path: "2020-12.md" };
	assert.deepEqual(selectedRows(december, "dateProperties"), ["1 dots-dated Kickoff", "31 dots-dated Project foo", "31 dots-dated Tax filing"]);
	assert.deepEqual(selectedRange(december, ISO_WEEK_RULE), { start: { year: 2020, month: 12, day: 1 }, end: { year: 2020, month: 12, day: 31 } });
	assert.deepEqual(selectedRange({ ...december, period: "day" }, ISO_WEEK_RULE), dayRange(december.date));
});
