import { addDays, addMonths } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { firstDayOf, monthOf } from "./grid.ts";
import type { CivilMonth } from "./grid.ts";

export function sameDay(one: CivilDate, other: CivilDate): boolean {
	return one.year === other.year && one.month === other.month && one.day === other.day;
}

export function sameMonth(one: CivilMonth, other: CivilMonth): boolean {
	return one.year === other.year && one.month === other.month;
}

export function shiftMonth(month: CivilMonth, months: number): CivilMonth {
	return monthOf(addMonths(firstDayOf(month), months));
}

export function monthAfterDayChange(displayed: CivilMonth, previousToday: CivilDate, today: CivilDate): CivilMonth {
	return sameMonth(displayed, monthOf(previousToday)) ? monthOf(today) : { year: displayed.year, month: displayed.month };
}

const DAYS_IN_WEEK = 7;

export function shiftWeek(anchor: CivilDate, weeks: number): CivilDate {
	return addDays(anchor, weeks * DAYS_IN_WEEK);
}

export function startOfMonthBefore(anchor: CivilDate): CivilDate {
	const month = anchor.day === 1 ? shiftMonth(monthOf(anchor), -1) : monthOf(anchor);
	return firstDayOf(month);
}

export function startOfNextMonth(anchor: CivilDate): CivilDate {
	return firstDayOf(shiftMonth(monthOf(anchor), 1));
}

export function anchorAfterDayChange(anchor: CivilDate, previousToday: CivilDate, today: CivilDate): CivilDate {
	return sameDay(anchor, previousToday) ? today : anchor;
}
