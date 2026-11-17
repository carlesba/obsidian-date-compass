import { addDays, addUnits, civilOf, daysInMonth, isoDate, isValidDate, weekdayOf, type CivilDate } from "./calendar.ts";
import type { DateNode, ParseOptions, ParsedNode, PeriodNode, Resolved, Span, Unit, Weekday, WeekdayWhich } from "./types.ts";

export function resolve(node: ParsedNode, now: Date, options: ParseOptions): Resolved | undefined {
	const today = civilOf(now);
	const span = node.kind === "period" ? resolvePeriod(node, today, options) : daySpan(resolveDate(node, today, options));
	return span && { kind: "single", span };
}

function daySpan(date: CivilDate | undefined): Span | undefined {
	return date && { unit: "day", start: isoDate(date), end: isoDate(date) };
}

export function resolveDate(node: DateNode, today: CivilDate, options: ParseOptions): CivilDate | undefined {
	switch (node.kind) {
		case "day":
			return addUnits(today, node.amount, node.unit);
		case "weekday":
			return resolveWeekday(node.day, node.which, today, options);
		case "calendar":
			return calendarDate(node.year ?? today.year, node.month, node.day);
		case "numeric": {
			const [day, month] = options.dayMonthOrder === "dayMonth" ? [node.first, node.second] : [node.second, node.first];
			return calendarDate(node.year ?? today.year, month, day);
		}
	}
}

function calendarDate(year: number, month: number, day: number): CivilDate | undefined {
	return isValidDate(year, month, day) ? { year, month, day } : undefined;
}

function resolveWeekday(day: Weekday, which: WeekdayWhich, today: CivilDate, options: ParseOptions): CivilDate {
	const todayWeekday = weekdayOf(today);
	const thisWeek = addDays(startOfWeek(today, options), (day - weekStartDay(options) + 7) % 7);
	const nextOccurrence = addDays(today, (day - todayWeekday + 7) % 7 || 7);
	switch (which) {
		case "bare":
			return nextOccurrence;
		case "this":
			return thisWeek;
		case "next":
			return options.nextWeekday === "nextWeek" ? addDays(thisWeek, 7) : nextOccurrence;
		case "last":
			return addDays(today, -((todayWeekday - day + 7) % 7 || 7));
	}
}

function weekStartDay(options: ParseOptions): Weekday {
	return options.weekStart === "sunday" ? 0 : 1;
}

function startOfWeek(date: CivilDate, options: ParseOptions): CivilDate {
	return addDays(date, -((weekdayOf(date) - weekStartDay(options) + 7) % 7));
}

function resolvePeriod(node: PeriodNode, today: CivilDate, options: ParseOptions): Span | undefined {
	const anchor = node.anchor;
	if ("offset" in anchor) return periodSpan(node.unit, addUnits(periodStart(node.unit, today, options), anchor.offset, node.unit), options);
	if ("containing" in anchor) {
		const date = resolveDate(anchor.containing, today, options);
		return date && periodSpan(node.unit, date, options);
	}
	const start = explicitStart(node.unit, anchor.explicit.year, anchor.explicit.index, today);
	return start && periodSpan(node.unit, start, options);
}

function explicitStart(unit: Unit, year: number | undefined, index: number, today: CivilDate): CivilDate | undefined {
	switch (unit) {
		case "day":
			return undefined;
		case "week":
			return isoWeekMonday(year ?? isoWeekYear(today), index);
		case "month":
			return index >= 1 && index <= 12 ? { year: year ?? today.year, month: index, day: 1 } : undefined;
		case "quarter":
			return index >= 1 && index <= 4 ? { year: year ?? today.year, month: (index - 1) * 3 + 1, day: 1 } : undefined;
		case "year":
			return index >= 1 ? { year: index, month: 1, day: 1 } : undefined;
	}
}

function isoWeekMonday(year: number, week: number): CivilDate | undefined {
	if (week < 1) return undefined;
	const januaryFourth: CivilDate = { year, month: 1, day: 4 };
	const firstMonday = addDays(januaryFourth, -((weekdayOf(januaryFourth) + 6) % 7));
	const monday = addDays(firstMonday, (week - 1) * 7);
	return isoWeekYear(monday) === year ? monday : undefined;
}

function isoWeekYear(date: CivilDate): number {
	return addDays(date, 3 - ((weekdayOf(date) + 6) % 7)).year;
}

function periodStart(unit: Unit, date: CivilDate, options: ParseOptions): CivilDate {
	switch (unit) {
		case "day":
			return date;
		case "week":
			return startOfWeek(date, options);
		case "month":
			return { year: date.year, month: date.month, day: 1 };
		case "quarter":
			return { year: date.year, month: Math.floor((date.month - 1) / 3) * 3 + 1, day: 1 };
		case "year":
			return { year: date.year, month: 1, day: 1 };
	}
}

function periodSpan(unit: Unit, date: CivilDate, options: ParseOptions): Span {
	const start = periodStart(unit, date, options);
	const end = periodEnd(unit, start);
	return { unit, start: isoDate(start), end: isoDate(end) };
}

function periodEnd(unit: Unit, start: CivilDate): CivilDate {
	switch (unit) {
		case "day":
			return start;
		case "week":
			return addDays(start, 6);
		case "month":
			return { year: start.year, month: start.month, day: daysInMonth(start.year, start.month) };
		case "quarter":
			return { year: start.year, month: start.month + 2, day: daysInMonth(start.year, start.month + 2) };
		case "year":
			return { year: start.year, month: 12, day: 31 };
	}
}
