import type { Category, DateNode, Element, Meaning, MeaningType, ParsedNode, Part, PeriodNode, Unit, Weekday } from "./types.ts";

export function token(type: MeaningType, test?: (meaning: Meaning) => boolean): Element {
	return test ? { type, test } : { type };
}

export function phrase(node: Category): Element {
	return { node };
}

export function symbol(text: string): Element {
	return token("symbol", (meaning) => meaning.type === "symbol" && meaning.value === text);
}

export function unit(only: Unit): Element {
	return token("unit", (meaning) => meaning.type === "unit" && meaning.value === only);
}

export function fourDigitNumber(): Element {
	return token("number", (meaning) => meaning.type === "number" && meaning.digits === 4);
}

export function digitNumber(): Element {
	return token("number", (meaning) => meaning.type === "number" && meaning.digits !== undefined);
}

export function numberOf(part: Part): number {
	if (part.type !== "number") throw new TypeError(`expected a number, got ${part.type}`);
	return part.value;
}

export function unitOf(part: Part): Unit {
	if (part.type !== "unit") throw new TypeError(`expected a unit, got ${part.type}`);
	return part.value;
}

export function weekdayOf(part: Part): Weekday {
	if (part.type !== "weekday") throw new TypeError(`expected a weekday, got ${part.type}`);
	return part.value;
}

export function monthOf(part: Part): number {
	if (part.type !== "month") throw new TypeError(`expected a month, got ${part.type}`);
	return part.value;
}

export function relativeDayOf(part: Part): number {
	if (part.type !== "relativeDay") throw new TypeError(`expected a relative day, got ${part.type}`);
	return part.value;
}

export function isDateNode(node: ParsedNode): node is DateNode {
	return node.kind === "day" || node.kind === "weekday" || node.kind === "calendar" || node.kind === "numeric";
}

export function dateOf(part: Part): DateNode {
	if (part.type !== "node" || !isDateNode(part.value)) throw new TypeError(`expected a date, got ${part.type}`);
	return part.value;
}

export function periodOf(part: Part): PeriodNode {
	if (part.type !== "node" || part.value.kind !== "period") throw new TypeError(`expected a period, got ${part.type}`);
	return part.value;
}

export function rangeEndOf(part: Part): DateNode | PeriodNode {
	if (part.type === "node" && part.value.kind === "period") return part.value;
	return dateOf(part);
}

export function weekdaysOf(part: Part): Weekday[] {
	if (part.type === "weekday") return [part.value];
	if (part.type !== "node" || part.value.kind !== "weekdays") throw new TypeError(`expected weekdays, got ${part.type}`);
	return part.value.days;
}
