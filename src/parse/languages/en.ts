import { dateOf, everyShapesWithStarts, fourDigitNumber, monthOf, numberOf, periodOf, phrase, rangeEndOf, relativeDayOf, symbol, token, unitOf, weekdayOf, weekdaysOf } from "../shape.ts";
import type { EveryPart } from "../shape.ts";
import type { Amount, Category, Element, EveryNode, Language, LexiconEntry, Shape, Weekday } from "../types.ts";

const weekdays: Array<[Weekday, string[]]> = [
	[0, ["sun", "sunday"]],
	[1, ["mon", "monday"]],
	[2, ["tue", "tues", "tuesday"]],
	[3, ["wed", "wednesday"]],
	[4, ["thu", "thur", "thurs", "thursday"]],
	[5, ["fri", "friday"]],
	[6, ["sat", "saturday"]],
];

const months: string[][] = [
	["jan", "january"],
	["feb", "february"],
	["mar", "march"],
	["apr", "april"],
	["may"],
	["jun", "june"],
	["jul", "july"],
	["aug", "august"],
	["sep", "sept", "september"],
	["oct", "october"],
	["nov", "november"],
	["dec", "december"],
];

const numberWords: string[][] = [
	["a", "an", "one"],
	["two"],
	["three"],
	["four"],
	["five"],
	["six"],
	["seven"],
	["eight"],
	["nine"],
	["ten"],
	["eleven"],
	["twelve"],
];

const lexicon: LexiconEntry[] = [
	{ words: ["today"], meaning: { type: "relativeDay", value: 0 } },
	{ words: ["tmr", "tomorrow"], meaning: { type: "relativeDay", value: 1 } },
	{ words: ["yest", "yesterday"], meaning: { type: "relativeDay", value: -1 } },
	...weekdays.map(([value, words]): LexiconEntry => ({ words, meaning: { type: "weekday", value } })),
	...months.map((words, index): LexiconEntry => ({ words, meaning: { type: "month", value: index + 1 } })),
	...numberWords.map((words, index): LexiconEntry => ({ words, meaning: { type: "number", value: index + 1 } })),
	{ words: ["day", "days"], meaning: { type: "unit", value: "day" } },
	{ words: ["wk", "week", "weeks"], meaning: { type: "unit", value: "week" } },
	{ words: ["mo", "month", "months"], meaning: { type: "unit", value: "month" } },
	{ words: ["quarter", "quarters"], meaning: { type: "unit", value: "quarter" } },
	{ words: ["yr", "year", "years"], meaning: { type: "unit", value: "year" } },
	{ words: ["next"], meaning: { type: "next" } },
	{ words: ["last"], meaning: { type: "last" } },
	{ words: ["this"], meaning: { type: "this" } },
	{ words: ["ago"], meaning: { type: "ago" } },
	{ words: ["in"], meaning: { type: "in" } },
	{ words: ["of"], meaning: { type: "of" } },
	{ words: ["st", "nd", "rd", "th"], meaning: { type: "ordinal" } },
	{ words: ["to", "until"], meaning: { type: "rangeJoin" } },
	{ words: ["from"], meaning: { type: "from" } },
	{ words: ["every"], meaning: { type: "every" } },
	{ words: ["for"], meaning: { type: "for" } },
	{ words: ["times"], meaning: { type: "times" } },
	{ words: ["and"], meaning: { type: "and" } },
	{ words: ["other"], meaning: { type: "other" } },
	{ words: ["until", "till"], meaning: { type: "until" } },
	{ words: ["starting", "starting on", "starting from", "beginning", "from"], meaning: { type: "starting" } },
];

const rangeJoins: Element[][] = [[token("rangeJoin")], [symbol("-")], [symbol("."), symbol(".")]];

const rangeEnds: Category[] = ["date", "period"];

const rangeShapes: Shape[] = rangeEnds.flatMap((end) =>
	rangeJoins.flatMap((join): Shape[] => [
		{
			produces: "sequence",
			elements: [phrase(end), ...join, phrase(end)],
			build: (parts) => ({ kind: "range", from: rangeEndOf(parts[0]), to: rangeEndOf(parts[parts.length - 1]) }),
		},
		{
			produces: "sequence",
			elements: [token("from"), phrase(end), ...join, phrase(end)],
			build: (parts) => ({ kind: "range", from: rangeEndOf(parts[1]), to: rangeEndOf(parts[parts.length - 1]) }),
		},
	]),
);

const weekdayListJoins: Element[][] = [[symbol(",")], [token("and")], [symbol(","), token("and")]];

const weekdayListShapes: Shape[] = [
	{
		produces: "weekdays",
		elements: [token("weekday")],
		build: ([day]) => ({ kind: "weekdays", days: [weekdayOf(day)] }),
	},
	...weekdayListJoins.map((join): Shape => ({
		produces: "weekdays",
		elements: [token("weekday"), ...join, phrase("weekdays")],
		build: (parts) => ({ kind: "weekdays", days: [...new Set([weekdayOf(parts[0]), ...weekdaysOf(parts[parts.length - 1])])] }),
	})),
];

const everyPatterns: Array<EveryPart<EveryNode["pattern"]>> = [
	{ elements: [phrase("weekdays")], read: ([days]) => ({ weekdays: weekdaysOf(days) }) },
	{ elements: [token("other"), phrase("weekdays")], read: ([, days]) => ({ weekdays: weekdaysOf(days), weekStep: 2 }) },
	{ elements: [token("unit")], read: ([unit]): { step: Amount } => ({ step: { amount: 1, unit: unitOf(unit) } }) },
	{ elements: [token("other"), token("unit")], read: ([, unit]): { step: Amount } => ({ step: { amount: 2, unit: unitOf(unit) } }) },
	{ elements: [token("number"), token("unit")], read: ([amount, unit]) => ({ step: { amount: numberOf(amount), unit: unitOf(unit) } }) },
];

const forBound: EveryPart<EveryNode["bound"]> = {
	elements: [token("for"), token("number"), token("unit")],
	read: ([, amount, unit]) => ({ for: { amount: numberOf(amount), unit: unitOf(unit) } }),
};

const everyBounds: Array<EveryPart<EveryNode["bound"]>> = [
	forBound,
	{ elements: [token("for"), token("number"), token("times")], read: ([, times]) => ({ times: numberOf(times) }) },
	{ elements: [token("number"), token("times")], read: ([times]) => ({ times: numberOf(times) }) },
	{ elements: [token("times"), token("number")], read: ([, times]) => ({ times: numberOf(times) }) },
	{ elements: [token("until"), phrase("date")], read: ([, end]) => ({ until: dateOf(end) }) },
];

const everyShapes: Shape[] = [
	...everyPatterns.flatMap((pattern) => everyBounds.flatMap((bound) => everyShapesWithStarts([token("every")], pattern, bound))),
	...everyShapesWithStarts([], everyPatterns[0], forBound),
];

const countShapes: Shape[] = (["next", "last"] as const).map((which) => ({
	produces: "sequence",
	elements: [token(which), token("number"), token("unit")],
	build: ([, amount, unit]) => ({ kind: "count", which, amount: numberOf(amount), unit: unitOf(unit) }),
}));

const relativeWords: Array<{ type: "this" | "next" | "last"; offset: number }> = [
	{ type: "this", offset: 0 },
	{ type: "next", offset: 1 },
	{ type: "last", offset: -1 },
];

const shapes: Shape[] = [
	{
		produces: "date",
		elements: [token("relativeDay")],
		build: ([day]) => ({ kind: "day", amount: relativeDayOf(day), unit: "day" }),
	},
	{
		produces: "date",
		elements: [token("weekday")],
		build: ([day]) => ({ kind: "weekday", day: weekdayOf(day), which: "bare" }),
	},
	...relativeWords.map(({ type }): Shape => ({
		produces: "date",
		elements: [token(type), token("weekday")],
		build: ([, day]) => ({ kind: "weekday", day: weekdayOf(day), which: type }),
	})),
	{
		produces: "date",
		elements: [token("number"), token("unit"), token("ago")],
		build: ([amount, unit]) => ({ kind: "day", amount: -numberOf(amount), unit: unitOf(unit) }),
	},
	{
		produces: "date",
		elements: [token("in"), token("number"), token("unit")],
		build: ([, amount, unit]) => ({ kind: "day", amount: numberOf(amount), unit: unitOf(unit) }),
	},
	{
		produces: "date",
		elements: [token("number"), token("unit")],
		build: ([amount, unit]) => ({ kind: "day", amount: numberOf(amount), unit: unitOf(unit) }),
	},
	{
		produces: "date",
		elements: [symbol("+"), token("number"), token("unit")],
		build: ([, amount, unit]) => ({ kind: "day", amount: numberOf(amount), unit: unitOf(unit) }),
	},
	{
		produces: "date",
		elements: [symbol("-"), token("number"), token("unit")],
		build: ([, amount, unit]) => ({ kind: "day", amount: -numberOf(amount), unit: unitOf(unit) }),
	},
	{
		produces: "date",
		elements: [token("month"), token("number")],
		build: ([month, day]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("month"), token("number"), token("ordinal")],
		build: ([month, day]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("month"), token("number"), fourDigitNumber()],
		build: ([month, day, year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("month"), token("number"), token("ordinal"), fourDigitNumber()],
		build: ([month, day, , year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("number"), token("month")],
		build: ([day, month]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("number"), token("ordinal"), token("month")],
		build: ([day, , month]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("number"), token("ordinal"), token("of"), token("month")],
		build: ([day, , , month]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "date",
		elements: [token("number"), token("month"), fourDigitNumber()],
		build: ([day, month, year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	},
	...relativeWords.map(({ type, offset }): Shape => ({
		produces: "period",
		elements: [token(type), token("unit")],
		build: ([, unit]) => ({ kind: "period", unit: unitOf(unit), anchor: { offset } }),
	})),
	{
		produces: "period",
		elements: [token("month")],
		build: ([month]) => ({ kind: "period", unit: "month", anchor: { explicit: { index: monthOf(month) } } }),
	},
	{
		produces: "period",
		elements: [token("month"), fourDigitNumber()],
		build: ([month, year]) => ({ kind: "period", unit: "month", anchor: { explicit: { year: numberOf(year), index: monthOf(month) } } }),
	},
	{
		produces: "period",
		elements: [token("unit"), token("of"), phrase("date")],
		build: ([unit, , date]) => ({ kind: "period", unit: unitOf(unit), anchor: { containing: dateOf(date) } }),
	},
	{
		produces: "sequence",
		elements: [token("unit"), token("of"), phrase("period")],
		build: ([unit, , period]) => ({ kind: "within", unit: unitOf(unit), period: periodOf(period) }),
	},
	...rangeShapes,
	...countShapes,
	...everyShapes,
	...weekdayListShapes,
];

export const en: Language = { id: "en", lexicon, shapes, hintWords: { plain: ["every", "other", "wed", "for", "times", "2", "5"], singularUnits: ["day", "week", "month"], pluralUnits: ["days", "weeks", "months"], startWord: "starting", startDates: ["tomorrow", "next week", "next month"] } };
