import { digitNumber, fourDigitNumber, numberOf, symbol, token, unit, unitOf } from "../shape.ts";
import type { Language } from "../types.ts";

export const shared: Language = {
	id: "shared",
	hintWords: { plain: [], singularUnits: [], pluralUnits: [] },
	lexicon: [
		{ words: ["d"], meaning: { type: "unit", value: "day" } },
		{ words: ["w"], meaning: { type: "unit", value: "week" } },
		{ words: ["m"], meaning: { type: "unit", value: "month" } },
		{ words: ["q"], meaning: { type: "unit", value: "quarter" } },
		{ words: ["y"], meaning: { type: "unit", value: "year" } },
		{ words: ["x"], meaning: { type: "times" } },
	],
	shapes: [
		{
			produces: "date",
			elements: [fourDigitNumber(), symbol("-"), digitNumber(), symbol("-"), digitNumber()],
			build: ([year, , month, , day]) => ({ kind: "calendar", year: numberOf(year), month: numberOf(month), day: numberOf(day) }),
		},
		{
			produces: "date",
			elements: [symbol("+"), digitNumber(), token("unit")],
			build: ([, amount, which]) => ({ kind: "day", amount: numberOf(amount), unit: unitOf(which) }),
		},
		{
			produces: "date",
			elements: [symbol("-"), digitNumber(), token("unit")],
			build: ([, amount, which]) => ({ kind: "day", amount: -numberOf(amount), unit: unitOf(which) }),
		},
		{
			produces: "date",
			elements: [digitNumber(), token("unit")],
			build: ([amount, which]) => ({ kind: "day", amount: numberOf(amount), unit: unitOf(which) }),
		},
		{
			produces: "date",
			elements: [digitNumber(), symbol("/"), digitNumber()],
			build: ([first, , second]) => ({ kind: "numeric", first: numberOf(first), second: numberOf(second) }),
		},
		{
			produces: "date",
			elements: [digitNumber(), symbol("/"), digitNumber(), symbol("/"), fourDigitNumber()],
			build: ([first, , second, , year]) => ({ kind: "numeric", first: numberOf(first), second: numberOf(second), year: numberOf(year) }),
		},
		{
			produces: "period",
			elements: [unit("week"), digitNumber()],
			build: ([, index]) => ({ kind: "period", unit: "week", anchor: { explicit: { index: numberOf(index) } } }),
		},
		{
			produces: "period",
			elements: [fourDigitNumber(), symbol("-"), unit("week"), digitNumber()],
			build: ([year, , , index]) => ({ kind: "period", unit: "week", anchor: { explicit: { year: numberOf(year), index: numberOf(index) } } }),
		},
		{
			produces: "period",
			elements: [unit("quarter"), digitNumber()],
			build: ([, index]) => ({ kind: "period", unit: "quarter", anchor: { explicit: { index: numberOf(index) } } }),
		},
		{
			produces: "period",
			elements: [fourDigitNumber(), symbol("-"), unit("quarter"), digitNumber()],
			build: ([year, , , index]) => ({ kind: "period", unit: "quarter", anchor: { explicit: { year: numberOf(year), index: numberOf(index) } } }),
		},
		{
			produces: "period",
			elements: [fourDigitNumber()],
			build: ([year]) => ({ kind: "period", unit: "year", anchor: { explicit: { index: numberOf(year) } } }),
		},
	],
};
