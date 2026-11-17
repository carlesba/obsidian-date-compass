import { dateOf, fourDigitNumber, monthOf, numberOf, phrase, relativeDayOf, token, unitOf, weekdayOf } from "../shape.ts";
import type { Language, LexiconEntry, Shape, Weekday } from "../types.ts";

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
];

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
];

export const en: Language = { id: "en", lexicon, shapes };
