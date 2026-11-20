import type { Period } from "../dateNotes/periods.ts";
import { daysBetween } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import type { CellDots, Dot, DotPlace, DotReference, DotTime } from "./decorators.ts";
import { dayRange, headerRange } from "./dateProperties.ts";
import type { DateRange } from "./dateProperties.ts";
import { firstDayOf, weekdayOrder } from "./grid.ts";
import type { CivilMonth, MonthGrid } from "./grid.ts";
import { quarterOf } from "./header.ts";
import type { HeaderPart, HeaderPeriod } from "./header.ts";
import type { VisibleNotes } from "./paths.ts";
import type { WeekRule } from "./weeks.ts";

export interface NoteTarget {
	period: Period;
	date: CivilDate;
	path: string;
}

export interface NoteCell {
	target: NoteTarget | undefined;
	hasNote: boolean;
	active: boolean;
	dots: Dot[];
	references: DotReference[];
}

export interface DayCell extends NoteCell {
	label: string;
	today: boolean;
	adjacentMonth: boolean;
}

export interface WeekCell extends NoteCell {
	label: string;
}

export interface TitlePart extends NoteCell {
	period: HeaderPeriod;
	label: string;
}

export interface WeekdayHeading {
	label: string;
	weekend: boolean;
}

export interface CalendarRow {
	week: WeekCell | undefined;
	days: DayCell[];
}

export interface CalendarModel {
	title: TitlePart[];
	weekdays: WeekdayHeading[];
	showsWeekColumn: boolean;
	showsDotsAbove: boolean;
	rows: CalendarRow[];
}

export type NavigationStep = "month" | "week";

export interface CalendarScreen {
	step: NavigationStep;
	months: CalendarModel[];
}

export interface CalendarModelInput {
	grid: MonthGrid;
	today: CivilDate;
	notes: VisibleNotes;
	parts: readonly HeaderPart[];
	rule: WeekRule;
	weekdayNames: readonly string[];
	showWeekNumbers: boolean;
	activePath: string | undefined;
	noteExists: (path: string) => boolean;
	showsDotsAbove: boolean;
	dotsOf: (path: string, place: DotPlace, hasNote: boolean, days: DateRange) => CellDots;
}

export const CLICKABLE_CLASS = "is-clickable";
const MONTH_LOOK_CLASS = "month";

export function calendarModel(input: CalendarModelInput): CalendarModel {
	const { grid, today, notes, parts, rule, weekdayNames, showWeekNumbers } = input;
	const displayed = firstDayOf(grid.month);
	return {
		title: parts.map((part) => ({
			...noteCell(input, part.period, displayed, part.clickable ? notes.header[part.period] : undefined, { cell: part.period, time: headerTime(part.period, grid.month, today) }, headerRange(part.period, grid.month)),
			period: part.period,
			label: part.label,
		})),
		weekdays: weekdayOrder(rule).map(({ weekday, weekend }) => ({ label: weekdayNames[weekday] ?? "", weekend })),
		showsWeekColumn: showWeekNumbers,
		showsDotsAbove: input.showsDotsAbove,
		rows: grid.rows.map((row, rowIndex) => ({
			week: showWeekNumbers
				? { ...noteCell(input, "week", row.weekNoteDate, notes.rows[rowIndex]?.week, { cell: "week", time: weekTime(row.days.map((day) => day.date), today) }, weekRange(row.days.map((day) => day.date))), label: String(row.weekNumber) }
				: undefined,
			days: row.days.map((day, column) => ({
				...noteCell(input, "day", day.date, notes.rows[rowIndex]?.days[column], { cell: "day", time: dayTime(day.date, today) }, dayRange(day.date)),
				label: String(day.date.day),
				today: day.today,
				adjacentMonth: day.adjacentMonth,
			})),
		})),
	};
}

export function dayTime(date: CivilDate, today: CivilDate): DotTime {
	const daysFromToday = daysBetween(today, date);
	if (daysFromToday === 0) return "current";
	return daysFromToday < 0 ? "past" : "future";
}

export function weekTime(days: readonly CivilDate[], today: CivilDate): DotTime {
	const times = days.map((day) => dayTime(day, today));
	if (times.includes("current")) return "current";
	return times.every((time) => time === "past") ? "past" : "future";
}

export function headerTime(period: HeaderPeriod, month: CivilMonth, today: CivilDate): DotTime {
	const index = headerIndex(period, month) - headerIndex(period, today);
	if (index === 0) return "current";
	return index < 0 ? "past" : "future";
}

function headerIndex(period: HeaderPeriod, month: CivilMonth): number {
	switch (period) {
		case "month":
			return month.year * 12 + month.month;
		case "quarter":
			return month.year * 4 + quarterOf(month);
		case "year":
			return month.year;
	}
}

export function dayClasses(cell: DayCell): string[] {
	return classesOf("day", cell, { today: cell.today, "adjacent-month": cell.adjacentMonth });
}

export function dotClasses(dot: Dot): string[] {
	return ["dot", dot.shape, ...(dot.source === "openTasks" ? ["task"] : []), ...(dot.color === "default" ? [] : [`dot-color-${dot.color}`])];
}

export function weekClasses(cell: WeekCell): string[] {
	return classesOf("week-num", cell, {});
}

export function titlePartClasses(part: TitlePart): string[] {
	const classes = classesOf(part.period, part, {});
	return part.period === "quarter" ? [...classes, MONTH_LOOK_CLASS] : classes;
}

function weekRange(days: readonly CivilDate[]): DateRange {
	const [first] = days;
	return { start: first, end: days[days.length - 1] ?? first };
}

function noteCell(input: CalendarModelInput, period: Period, date: CivilDate, path: string | undefined, place: DotPlace, days: DateRange): NoteCell {
	if (path === undefined) return { target: undefined, hasNote: false, active: false, dots: [], references: [] };
	const hasNote = input.noteExists(path);
	return {
		target: { period, date, path },
		hasNote,
		active: path === input.activePath,
		...input.dotsOf(path, place, hasNote, days),
	};
}

function classesOf(base: string, cell: NoteCell, extra: Record<string, boolean>): string[] {
	const states: Record<string, boolean> = {
		...extra,
		active: cell.active,
		"has-note": cell.hasNote,
		[CLICKABLE_CLASS]: cell.target !== undefined,
	};
	return [base, ...Object.keys(states).filter((state) => states[state])];
}
