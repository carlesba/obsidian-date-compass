import { addMonths } from "../parse/calendar.ts";
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
