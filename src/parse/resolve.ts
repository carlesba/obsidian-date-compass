import { addDays, addUnits, civilOf, daysBetween, daysInMonth, isoDate, isValidDate, weekdayOf, type CivilDate } from "./calendar.ts";
import { isDateNode } from "./shape.ts";
import type { CountNode, DateNode, EveryNode, Outcome, ParseOptions, ParsedNode, PeriodNode, RangeNode, Span, Unit, Weekday, WeekdayWhich, WithinNode } from "./types.ts";

export const SEQUENCE_LIMIT = 366;

export function resolve(node: ParsedNode, now: Date, options: ParseOptions): Outcome | undefined {
	const today = civilOf(now);
	switch (node.kind) {
		case "period": {
			const span = resolvePeriod(node, today, options);
			return span && { kind: "single", span };
		}
		case "range":
			return resolveRange(node, today, options);
		case "count":
			return resolveCount(node, today, options);
		case "every":
			return resolveEvery(node, today, options);
		case "within":
			return resolveWithin(node, today, options);
		case "weekdays":
			return undefined;
		default: {
			const date = resolveDate(node, today, options);
			return date && { kind: "single", span: daySpan(date) };
		}
	}
}

function daySpan(date: CivilDate): Span {
	return { unit: "day", start: isoDate(date), end: isoDate(date) };
}

function sequenceOf(items: Span[]): Outcome | undefined {
	if (items.length === 0) return undefined;
	if (items.length > SEQUENCE_LIMIT) return { kind: "tooManyItems", limit: SEQUENCE_LIMIT };
	const first = items[0];
	const last = items[items.length - 1];
	return { kind: "sequence", span: { unit: first.unit, start: first.start, end: last.end }, items };
}

function collect(itemAt: (index: number) => Span | undefined): Span[] {
	const items: Span[] = [];
	for (let index = 0; items.length <= SEQUENCE_LIMIT; index++) {
		const item = itemAt(index);
		if (!item) break;
		items.push(item);
	}
	return items;
}

function ordered(from: CivilDate, to: CivilDate): [CivilDate, CivilDate] {
	return daysBetween(from, to) >= 0 ? [from, to] : [to, from];
}

function resolveRange(node: RangeNode, today: CivilDate, options: ParseOptions): Outcome | undefined {
	if (node.from.kind === "period" || node.to.kind === "period") {
		if (node.from.kind !== "period" || node.to.kind !== "period" || node.from.unit !== node.to.unit) return undefined;
		const unit = node.from.unit;
		const from = periodDate(node.from, today, options);
		const to = periodDate(node.to, today, options);
		if (!from || !to) return undefined;
		const [first, last] = ordered(periodStart(unit, from, options), periodStart(unit, to, options));
		return sequenceOf(collect((index) => {
			const start = periodStart(unit, addUnits(first, index, unit), options);
			return daysBetween(start, last) >= 0 ? periodSpan(unit, start, options) : undefined;
		}));
	}
	const from = resolveDate(node.from, today, options);
	if (!from) return undefined;
	const to = isDateNode(node.to) && node.to.kind === "weekday" && node.to.which === "bare" ? resolveWeekday(node.to.day, "bare", from, options) : resolveDate(node.to, today, options);
	if (!to) return undefined;
	const [first, last] = ordered(from, to);
	if (daysBetween(first, last) + 1 > SEQUENCE_LIMIT) return { kind: "tooManyItems", limit: SEQUENCE_LIMIT };
	return sequenceOf(collect((index) => (index <= daysBetween(first, last) ? daySpan(addDays(first, index)) : undefined)));
}

function resolveCount(node: CountNode, today: CivilDate, options: ParseOptions): Outcome | undefined {
	if (node.amount < 1) return undefined;
	if (node.amount > SEQUENCE_LIMIT) return { kind: "tooManyItems", limit: SEQUENCE_LIMIT };
	const current = periodStart(node.unit, today, options);
	const firstOffset = node.which === "next" ? 0 : 1 - node.amount;
	return sequenceOf(collect((index) => (index < node.amount ? periodSpan(node.unit, addUnits(current, firstOffset + index, node.unit), options) : undefined)));
}

function resolveEvery(node: EveryNode, today: CivilDate, options: ParseOptions): Outcome | undefined {
	const bound = node.bound;
	if ("times" in bound) {
		if (bound.times < 1) return undefined;
		if (bound.times > SEQUENCE_LIMIT) return { kind: "tooManyItems", limit: SEQUENCE_LIMIT };
	} else if ("for" in bound && bound.for.amount < 1) return undefined;
	const pattern = node.pattern;
	if ("step" in pattern && pattern.step.amount < 1) return undefined;
	const first = firstCandidate(node, today, options);
	if (!first) return undefined;
	const accepts = acceptance(bound, first, today, options);
	if (!accepts) return undefined;
	if ("step" in pattern) {
		return sequenceOf(collect((index) => {
			const date = addUnits(first, index * pattern.step.amount, pattern.step.unit);
			return accepts(date, index) ? daySpan(date) : undefined;
		}));
	}
	const weekdays = new Set(pattern.weekdays);
	const weekStep = pattern.weekStep ?? 1;
	const firstWeek = startOfWeek(first, options);
	let day = first;
	return sequenceOf(collect((index) => {
		while (!weekdays.has(weekdayOf(day)) || Math.floor(daysBetween(firstWeek, day) / 7) % weekStep !== 0) day = addDays(day, 1);
		const date = day;
		day = addDays(day, 1);
		return accepts(date, index) ? daySpan(date) : undefined;
	}));
}

function firstCandidate(node: EveryNode, today: CivilDate, options: ParseOptions): CivilDate | undefined {
	if (node.start) return startOfSpan(node.start, today, options);
	return "step" in node.pattern ? addUnits(today, node.pattern.step.amount, node.pattern.step.unit) : today;
}

function startOfSpan(node: DateNode | PeriodNode, today: CivilDate, options: ParseOptions): CivilDate | undefined {
	if (node.kind !== "period") return resolveDate(node, today, options);
	const date = periodDate(node, today, options);
	return date && periodStart(node.unit, date, options);
}

function untilDate(node: DateNode, today: CivilDate, options: ParseOptions): CivilDate | undefined {
	const end = resolveDate(node, today, options);
	if (!end || daysBetween(today, end) >= 0 || !(node.kind === "calendar" || node.kind === "numeric") || node.year !== undefined) return end;
	return resolveDate({ ...node, year: today.year + 1 }, today, options);
}

function acceptance(bound: EveryNode["bound"], first: CivilDate, today: CivilDate, options: ParseOptions): ((date: CivilDate, index: number) => boolean) | undefined {
	if ("times" in bound) return (_date, index) => index < bound.times;
	if ("until" in bound) {
		const end = untilDate(bound.until, today, options);
		return end && ((date) => daysBetween(date, end) >= 0);
	}
	const windowEnd = addUnits(first, bound.for.amount, bound.for.unit);
	return (date) => daysBetween(date, windowEnd) > 0;
}

function resolveWithin(node: WithinNode, today: CivilDate, options: ParseOptions): Outcome | undefined {
	const anchor = periodDate(node.period, today, options);
	if (!anchor) return undefined;
	const containerStart = periodStart(node.period.unit, anchor, options);
	const containerEnd = periodEnd(node.period.unit, containerStart);
	const first = periodStart(node.unit, containerStart, options);
	return sequenceOf(collect((index) => {
		const start = periodStart(node.unit, addUnits(first, index, node.unit), options);
		return daysBetween(start, containerEnd) >= 0 ? periodSpan(node.unit, start, options) : undefined;
	}));
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
	const date = periodDate(node, today, options);
	return date && periodSpan(node.unit, date, options);
}

function periodDate(node: PeriodNode, today: CivilDate, options: ParseOptions): CivilDate | undefined {
	const anchor = node.anchor;
	if ("offset" in anchor) return addUnits(periodStart(node.unit, today, options), anchor.offset, node.unit);
	if ("containing" in anchor) return resolveDate(anchor.containing, today, options);
	return explicitStart(node.unit, anchor.explicit.year, anchor.explicit.index, today);
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

export function periodStart(unit: Unit, date: CivilDate, options: ParseOptions): CivilDate {
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

export function periodSpan(unit: Unit, date: CivilDate, options: ParseOptions): Span {
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
