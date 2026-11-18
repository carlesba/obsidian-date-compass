import { PERIODS } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";
import { addDays, addUnits, daysBetween, isValidDate } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { periodSpan, periodStart } from "../parse/resolve.ts";
import type { ParseOptions, Span } from "../parse/types.ts";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_INTO_WEEK_THAT_NAME_IT = 3;

const MONTHS_PER_PERIOD = { month: 1, quarter: 3, year: 12 } as const;

export function retargetSpan(span: Span, today: CivilDate, options: ParseOptions, targets: readonly Period[]): Span | undefined {
	if (targets.length === 0) return undefined;
	if (targets.includes(span.unit)) return span;
	const start = civilDateOf(span.start);
	if (!start) return undefined;
	const coarser = targets.filter((target) => granularity(target) > granularity(span.unit));
	if (coarser.length > 0) return periodSpan(finest(coarser), dateNaming(span.unit, start), options);
	const shifted = addUnits(today, periodsBetween(span.unit, today, start, options), span.unit);
	return periodSpan(coarsest(targets), shifted, options);
}

export function retargetSpans(spans: readonly Span[], today: CivilDate, options: ParseOptions, targets: readonly Period[]): Span[] | undefined {
	const retargeted: Span[] = [];
	for (const span of spans) {
		const item = retargetSpan(span, today, options, targets);
		if (!item) return undefined;
		retargeted.push(item);
	}
	return collapseRepeats(retargeted, spanKey);
}

export function collapseRepeats<Item>(items: readonly Item[], keyOf: (item: Item) => string): Item[] {
	return items.filter((item, index) => index === 0 || keyOf(item) !== keyOf(items[index - 1]));
}

export function spanKey(span: Span): string {
	return `${span.unit}:${span.start}`;
}

function granularity(period: Period): number {
	return PERIODS.indexOf(period);
}

function finest(periods: readonly Period[]): Period {
	return periods.reduce((best, period) => (granularity(period) < granularity(best) ? period : best));
}

function coarsest(periods: readonly Period[]): Period {
	return periods.reduce((best, period) => (granularity(period) > granularity(best) ? period : best));
}

function dateNaming(unit: Period, start: CivilDate): CivilDate {
	return unit === "week" ? addDays(start, DAYS_INTO_WEEK_THAT_NAME_IT) : start;
}

function periodsBetween(unit: Period, from: CivilDate, to: CivilDate, options: ParseOptions): number {
	const fromStart = periodStart(unit, from, options);
	const toStart = periodStart(unit, to, options);
	if (unit === "day") return daysBetween(fromStart, toStart);
	if (unit === "week") return daysBetween(fromStart, toStart) / 7;
	return ((toStart.year - fromStart.year) * 12 + toStart.month - fromStart.month) / MONTHS_PER_PERIOD[unit];
}

function civilDateOf(isoDate: string): CivilDate | undefined {
	const match = ISO_DATE.exec(isoDate);
	if (!match) return undefined;
	const [year, month, day] = match.slice(1).map(Number);
	return isValidDate(year, month, day) ? { year, month, day } : undefined;
}
