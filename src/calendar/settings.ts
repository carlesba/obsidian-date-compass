import { isRecord } from "../dateNotes/periods.ts";
import { mergeDecorators } from "./decorators.ts";
import type { DotDecorator } from "./decorators.ts";

export const CALENDAR_VIEWS = ["month", "weeks"] as const;
export type CalendarViewKind = (typeof CALENDAR_VIEWS)[number];

export const TODAY_ROWS = ["first", "middle", "last"] as const;
export type TodayRow = (typeof TODAY_ROWS)[number];

export const MONTHS_SHOWN = { min: 1, max: 3 } as const;
export const EXTRA_WEEKS = { min: 0, max: 4 } as const;
export const WEEKS_SHOWN = { min: 2, max: 12 } as const;

export type IntegerRange = { readonly min: number; readonly max: number };

export interface CalendarSettings {
	showWeekNumbers: boolean;
	confirmBeforeCreate: boolean;
	dimWithoutNote: boolean;
	view: CalendarViewKind;
	monthsShown: number;
	weeksBefore: number;
	weeksAfter: number;
	weeksShown: number;
	todayRow: TodayRow;
	decorators: DotDecorator[];
}

export function defaultCalendar(): CalendarSettings {
	return mergeCalendar(undefined);
}

export function isInRange(value: unknown, range: IntegerRange): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max;
}

export function todayRowIndex(todayRow: TodayRow, weeks: number): number {
	switch (todayRow) {
		case "first":
			return 0;
		case "middle":
			return Math.floor((weeks - 1) / 2);
		case "last":
			return weeks - 1;
	}
}

export function mergeCalendar(stored: unknown): CalendarSettings {
	const data = isRecord(stored) ? stored : {};
	const integer = (value: unknown, range: IntegerRange, fallback: number) => (isInRange(value, range) ? value : fallback);
	return {
		showWeekNumbers: typeof data.showWeekNumbers === "boolean" ? data.showWeekNumbers : true,
		confirmBeforeCreate: typeof data.confirmBeforeCreate === "boolean" ? data.confirmBeforeCreate : true,
		dimWithoutNote: typeof data.dimWithoutNote === "boolean" ? data.dimWithoutNote : false,
		view: CALENDAR_VIEWS.find((view) => view === data.view) ?? "month",
		monthsShown: integer(data.monthsShown, MONTHS_SHOWN, 1),
		weeksBefore: integer(data.weeksBefore, EXTRA_WEEKS, 0),
		weeksAfter: integer(data.weeksAfter, EXTRA_WEEKS, 0),
		weeksShown: integer(data.weeksShown, WEEKS_SHOWN, 6),
		todayRow: TODAY_ROWS.find((row) => row === data.todayRow) ?? "first",
		decorators: mergeDecorators(data.decorators, data.wordsPerDot),
	};
}
