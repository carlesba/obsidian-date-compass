import { addDays, weekdayOf } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { weekNumber } from "./weeks.ts";
import type { WeekRule } from "./weeks.ts";

export interface CivilMonth {
	year: number;
	month: number;
}

export interface GridDay {
	date: CivilDate;
	adjacentMonth: boolean;
	today: boolean;
}

export interface GridRow {
	weekNumber: number;
	weekNoteDate: CivilDate;
	days: GridDay[];
}

export interface MonthGrid {
	month: CivilMonth;
	rows: GridRow[];
}

export interface WeekdayColumn {
	weekday: number;
	weekend: boolean;
}

export const GRID_ROWS = 6;

const DAYS_IN_WEEK = 7;
const MIDDLE_OF_WEEK = 3;
const WEEKEND_DAYS = [0, 6];

export function monthOf(date: CivilDate): CivilMonth {
	return { year: date.year, month: date.month };
}

export function firstDayOf(month: CivilMonth): CivilDate {
	return { year: month.year, month: month.month, day: 1 };
}

export interface ExtraWeeks {
	before: number;
	after: number;
}

const NO_EXTRA_WEEKS: ExtraWeeks = { before: 0, after: 0 };

export function monthGrid(month: CivilMonth, rule: WeekRule, today?: CivilDate, extra: ExtraWeeks = NO_EXTRA_WEEKS): MonthGrid {
	const first = weekStartOf(firstDayOf(month), rule);
	return weeksGrid(addDays(first, -extra.before * DAYS_IN_WEEK), extra.before + GRID_ROWS + extra.after, month, rule, today);
}

export function weeksAroundGrid(anchor: CivilDate, weeks: number, anchorRow: number, rule: WeekRule, today?: CivilDate): MonthGrid {
	const first = addDays(weekStartOf(anchor, rule), -anchorRow * DAYS_IN_WEEK);
	return weeksGrid(first, weeks, monthOf(anchor), rule, today);
}

export function weekStartOf(date: CivilDate, rule: WeekRule): CivilDate {
	return addDays(date, -daysAfterWeekStart(weekdayOf(date), rule));
}

function weeksGrid(first: CivilDate, weeks: number, month: CivilMonth, rule: WeekRule, today: CivilDate | undefined): MonthGrid {
	const rows = Array.from({ length: weeks }, (_, rowIndex) => {
		const rowStart = addDays(first, rowIndex * DAYS_IN_WEEK);
		return {
			weekNumber: weekNumber(rowStart, rule),
			weekNoteDate: addDays(rowStart, MIDDLE_OF_WEEK),
			days: Array.from({ length: DAYS_IN_WEEK }, (_, column) => gridDay(addDays(rowStart, column), month, today)),
		};
	});
	return { month: { year: month.year, month: month.month }, rows };
}

export function weekdayOrder(rule: WeekRule): WeekdayColumn[] {
	return Array.from({ length: DAYS_IN_WEEK }, (_, column) => {
		const weekday = (rule.firstDayOfWeek + column) % DAYS_IN_WEEK;
		return { weekday, weekend: WEEKEND_DAYS.includes(weekday) };
	});
}

function daysAfterWeekStart(weekday: number, rule: WeekRule): number {
	return (DAYS_IN_WEEK + weekday - rule.firstDayOfWeek) % DAYS_IN_WEEK;
}

function gridDay(date: CivilDate, month: CivilMonth, today: CivilDate | undefined): GridDay {
	return {
		date,
		adjacentMonth: date.year !== month.year || date.month !== month.month,
		today: today !== undefined && sameDate(date, today),
	};
}

function sameDate(one: CivilDate, other: CivilDate): boolean {
	return one.year === other.year && one.month === other.month && one.day === other.day;
}
