import type { Period } from "../dateNotes/periods.ts";
import type { CivilDate } from "../parse/calendar.ts";
import type { Dot } from "./dots.ts";
import { firstDayOf, weekdayOrder } from "./grid.ts";
import type { MonthGrid } from "./grid.ts";
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
	rows: CalendarRow[];
}

export interface CalendarModelInput {
	grid: MonthGrid;
	notes: VisibleNotes;
	parts: readonly HeaderPart[];
	rule: WeekRule;
	weekdayNames: readonly string[];
	showWeekNumbers: boolean;
	activePath: string | undefined;
	noteExists: (path: string) => boolean;
	dotsOfNote: (path: string) => Dot[];
}

export const CLICKABLE_CLASS = "is-clickable";

export function calendarModel(input: CalendarModelInput): CalendarModel {
	const { grid, notes, parts, rule, weekdayNames, showWeekNumbers } = input;
	const displayed = firstDayOf(grid.month);
	return {
		title: parts.map((part) => ({
			...noteCell(input, part.period, displayed, part.clickable ? notes.header[part.period] : undefined, false),
			period: part.period,
			label: part.label,
		})),
		weekdays: weekdayOrder(rule).map(({ weekday, weekend }) => ({ label: weekdayNames[weekday] ?? "", weekend })),
		showsWeekColumn: showWeekNumbers,
		rows: grid.rows.map((row, rowIndex) => ({
			week: showWeekNumbers
				? { ...noteCell(input, "week", row.weekNoteDate, notes.rows[rowIndex]?.week, true), label: String(row.weekNumber) }
				: undefined,
			days: row.days.map((day, column) => ({
				...noteCell(input, "day", day.date, notes.rows[rowIndex]?.days[column], true),
				label: String(day.date.day),
				today: day.today,
				adjacentMonth: day.adjacentMonth,
			})),
		})),
	};
}

export function dayClasses(cell: DayCell): string[] {
	return classesOf("day", cell, { today: cell.today, "adjacent-month": cell.adjacentMonth });
}

export function weekClasses(cell: WeekCell): string[] {
	return classesOf("week-num", cell, {});
}

export function titlePartClasses(part: TitlePart): string[] {
	return classesOf(part.period, part, {});
}

function noteCell(input: CalendarModelInput, period: Period, date: CivilDate, path: string | undefined, withDots: boolean): NoteCell {
	if (path === undefined) return { target: undefined, hasNote: false, active: false, dots: [] };
	const hasNote = input.noteExists(path);
	return {
		target: { period, date, path },
		hasNote,
		active: path === input.activePath,
		dots: hasNote && withDots ? input.dotsOfNote(path) : [],
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
