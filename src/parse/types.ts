export type Unit = "day" | "week" | "month" | "quarter" | "year";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeekdayWhich = "bare" | "this" | "next" | "last";

export type Meaning =
	| { type: "weekday"; value: Weekday }
	| { type: "month"; value: number }
	| { type: "unit"; value: Unit }
	| { type: "relativeDay"; value: number }
	| { type: "number"; value: number; digits?: number }
	| { type: "symbol"; value: string }
	| { type: "next" | "last" | "this" | "ago" | "in" | "of" | "ordinal" | "article" | "rangeJoin" | "from" | "every" | "for" | "times" | "and" };

export type MeaningType = Meaning["type"];

export interface LexiconEntry {
	words: string[];
	meaning: Meaning;
}

export interface Alternative {
	language: string;
	meaning: Meaning;
}

export interface Token {
	text: string;
	alternatives: Alternative[];
}

export type DateNode =
	| { kind: "day"; amount: number; unit: Unit }
	| { kind: "weekday"; day: Weekday; which: WeekdayWhich }
	| { kind: "calendar"; year?: number; month: number; day: number }
	| { kind: "numeric"; first: number; second: number; year?: number };

export type PeriodAnchor =
	| { offset: number }
	| { explicit: { year?: number; index: number } }
	| { containing: DateNode };

export interface PeriodNode {
	kind: "period";
	unit: Unit;
	anchor: PeriodAnchor;
}

export interface RangeNode {
	kind: "range";
	from: DateNode | PeriodNode;
	to: DateNode | PeriodNode;
}

export interface CountNode {
	kind: "count";
	which: "next" | "last";
	amount: number;
	unit: Unit;
}

export interface Amount {
	amount: number;
	unit: Unit;
}

export interface EveryNode {
	kind: "every";
	pattern: { weekdays: Weekday[] } | { step: Amount };
	bound: { for: Amount } | { times: number };
}

export interface WithinNode {
	kind: "within";
	unit: Unit;
	period: PeriodNode;
}

export interface WeekdaysNode {
	kind: "weekdays";
	days: Weekday[];
}

export type SequenceNode = RangeNode | CountNode | EveryNode | WithinNode;

export type ParsedNode = DateNode | PeriodNode | SequenceNode | WeekdaysNode;

export type Category = "date" | "period" | "sequence" | "weekdays";

export type Part = Meaning | { type: "node"; value: ParsedNode };

export type Element =
	| { type: MeaningType; test?: (meaning: Meaning) => boolean }
	| { node: Category };

export interface Shape {
	produces: Category;
	elements: Element[];
	build: (parts: Part[]) => ParsedNode | undefined;
}

export interface Language {
	id: string;
	lexicon: LexiconEntry[];
	shapes: Shape[];
}

export interface ParseOptions {
	languages: string[];
	weekStart: "monday" | "sunday";
	nextWeekday: "nextWeek" | "nextOccurrence";
	dayMonthOrder: "dayMonth" | "monthDay";
}

export interface Span {
	unit: Unit;
	start: string;
	end: string;
}

export type Resolved = { kind: "single"; span: Span } | { kind: "sequence"; span: Span; items: Span[] };

export type Outcome = Resolved | { kind: "tooManyItems"; limit: number };

export interface Interpretation {
	language: string;
	node: ParsedNode;
	result: Resolved;
}

export interface Refusal {
	language: string;
	node: ParsedNode;
	reason: "tooManyItems";
	limit: number;
}

export interface Analysis {
	interpretations: Interpretation[];
	refusals: Refusal[];
}

export interface Completion {
	text: string;
	interpretations: Interpretation[];
}
