import { dateOf, fourDigitNumber, monthOf, numberOf, periodOf, phrase, rangeEndOf, relativeDayOf, symbol, token, unitOf, weekdayOf, weekdaysOf } from "../shape.ts";
import type { Amount, Category, Element, EveryNode, Language, LexiconEntry, Part, Shape, Weekday } from "../types.ts";

const weekdays: Array<[Weekday, string[]]> = [
	[0, ["dom", "domingo"]],
	[1, ["lun", "lunes"]],
	[2, ["mar", "martes"]],
	[3, ["mié", "miércoles"]],
	[4, ["jue", "jueves"]],
	[5, ["vie", "viernes"]],
	[6, ["sáb", "sábado"]],
];

const months: string[][] = [
	["ene", "enero"],
	["feb", "febrero"],
	["marzo"],
	["abr", "abril"],
	["may", "mayo"],
	["jun", "junio"],
	["jul", "julio"],
	["ago", "agosto"],
	["sep", "sept", "septiembre", "setiembre"],
	["oct", "octubre"],
	["nov", "noviembre"],
	["dic", "diciembre"],
];

const numberWords: string[][] = [
	["un", "una", "uno"],
	["dos"],
	["tres"],
	["cuatro"],
	["cinco"],
	["seis"],
	["siete"],
	["ocho"],
	["nueve"],
	["diez"],
	["once"],
	["doce"],
];

const lexicon: LexiconEntry[] = [
	{ words: ["hoy"], meaning: { type: "relativeDay", value: 0 } },
	{ words: ["mañana"], meaning: { type: "relativeDay", value: 1 } },
	{ words: ["pasado mañana"], meaning: { type: "relativeDay", value: 2 } },
	{ words: ["ayer"], meaning: { type: "relativeDay", value: -1 } },
	{ words: ["anteayer", "antier", "antes de ayer"], meaning: { type: "relativeDay", value: -2 } },
	...weekdays.map(([value, words]): LexiconEntry => ({ words, meaning: { type: "weekday", value } })),
	...months.map((words, index): LexiconEntry => ({ words, meaning: { type: "month", value: index + 1 } })),
	...numberWords.map((words, index): LexiconEntry => ({ words, meaning: { type: "number", value: index + 1 } })),
	{ words: ["día", "días"], meaning: { type: "unit", value: "day" } },
	{ words: ["sem", "semana", "semanas"], meaning: { type: "unit", value: "week" } },
	{ words: ["mes", "meses"], meaning: { type: "unit", value: "month" } },
	{ words: ["trimestre", "trimestres"], meaning: { type: "unit", value: "quarter" } },
	{ words: ["año", "años"], meaning: { type: "unit", value: "year" } },
	{ words: ["próximo", "próxima", "próximos", "próximas", "que viene", "que vienen"], meaning: { type: "next" } },
	{ words: ["pasado", "pasada", "último", "última", "últimos", "últimas"], meaning: { type: "last" } },
	{ words: ["este", "esta"], meaning: { type: "this" } },
	{ words: ["el", "la", "los", "las"], meaning: { type: "article" } },
	{ words: ["hace"], meaning: { type: "ago" } },
	{ words: ["en", "dentro de"], meaning: { type: "in" } },
	{ words: ["de", "del"], meaning: { type: "of" } },
	{ words: ["a", "al", "hasta"], meaning: { type: "rangeJoin" } },
	{ words: ["de", "del", "desde"], meaning: { type: "from" } },
	{ words: ["cada", "todos los", "todas las"], meaning: { type: "every" } },
	{ words: ["durante", "por"], meaning: { type: "for" } },
	{ words: ["vez", "veces"], meaning: { type: "times" } },
	{ words: ["y"], meaning: { type: "and" } },
	{ words: ["otro", "otra"], meaning: { type: "other" } },
	{ words: ["hasta"], meaning: { type: "until" } },
];

function withArticle(shape: Shape): Shape[] {
	return [shape, { ...shape, elements: [token("article"), ...shape.elements], build: (parts) => shape.build(parts.slice(1)) }];
}

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

interface EveryPart<T> {
	elements: Element[];
	read: (parts: Part[]) => T;
}

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

function everyShape(leading: Element[], pattern: EveryPart<EveryNode["pattern"]>, bound: EveryPart<EveryNode["bound"]>): Shape {
	return {
		produces: "sequence",
		elements: [...leading, ...pattern.elements, ...bound.elements],
		build: (parts) => {
			const patternParts = parts.slice(leading.length, leading.length + pattern.elements.length);
			const boundParts = parts.slice(leading.length + pattern.elements.length);
			return { kind: "every", pattern: pattern.read(patternParts), bound: bound.read(boundParts) };
		},
	};
}

const everyShapes: Shape[] = [
	...everyPatterns.flatMap((pattern) => everyBounds.map((bound) => everyShape([token("every")], pattern, bound))),
	everyShape([], everyPatterns[0], forBound),
];

const countShapes: Shape[] = (["next", "last"] as const).flatMap((which) =>
	withArticle({
		produces: "sequence",
		elements: [token(which), token("number"), token("unit")],
		build: ([, amount, unit]) => ({ kind: "count", which, amount: numberOf(amount), unit: unitOf(unit) }),
	}),
);

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
	...withArticle({
		produces: "date",
		elements: [token("weekday")],
		build: ([day]) => ({ kind: "weekday", day: weekdayOf(day), which: "bare" }),
	}),
	{
		produces: "date",
		elements: [token("this"), token("weekday")],
		build: ([, day]) => ({ kind: "weekday", day: weekdayOf(day), which: "this" }),
	},
	...withArticle({
		produces: "date",
		elements: [token("next"), token("weekday")],
		build: ([, day]) => ({ kind: "weekday", day: weekdayOf(day), which: "next" }),
	}),
	...(["next", "last"] as const).flatMap((which) =>
		withArticle({
			produces: "date",
			elements: [token("weekday"), token(which)],
			build: ([day]) => ({ kind: "weekday", day: weekdayOf(day), which }),
		}),
	),
	{
		produces: "date",
		elements: [token("ago"), token("number"), token("unit")],
		build: ([, amount, unit]) => ({ kind: "day", amount: -numberOf(amount), unit: unitOf(unit) }),
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
	...withArticle({
		produces: "date",
		elements: [token("number"), token("of"), token("month")],
		build: ([day, , month]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	}),
	...withArticle({
		produces: "date",
		elements: [token("number"), token("month")],
		build: ([day, month]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	}),
	...withArticle({
		produces: "date",
		elements: [token("number"), token("of"), token("month"), token("of"), fourDigitNumber()],
		build: ([day, , month, , year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	}),
	...withArticle({
		produces: "date",
		elements: [token("number"), token("of"), token("month"), fourDigitNumber()],
		build: ([day, , month, year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	}),
	...withArticle({
		produces: "date",
		elements: [token("number"), token("month"), fourDigitNumber()],
		build: ([day, month, year]) => ({ kind: "calendar", year: numberOf(year), month: monthOf(month), day: numberOf(day) }),
	}),
	{
		produces: "date",
		elements: [token("month"), token("number")],
		build: ([month, day]) => ({ kind: "calendar", month: monthOf(month), day: numberOf(day) }),
	},
	{
		produces: "period",
		elements: [token("this"), token("unit")],
		build: ([, unit]) => ({ kind: "period", unit: unitOf(unit), anchor: { offset: 0 } }),
	},
	...withArticle({
		produces: "period",
		elements: [token("next"), token("unit")],
		build: ([, unit]) => ({ kind: "period", unit: unitOf(unit), anchor: { offset: 1 } }),
	}),
	...relativeWords
		.filter(({ type }) => type !== "this")
		.flatMap(({ type, offset }) =>
			withArticle({
				produces: "period",
				elements: [token("unit"), token(type)],
				build: ([unit]) => ({ kind: "period", unit: unitOf(unit), anchor: { offset } }),
			}),
		),
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
		elements: [token("month"), token("of"), fourDigitNumber()],
		build: ([month, , year]) => ({ kind: "period", unit: "month", anchor: { explicit: { year: numberOf(year), index: monthOf(month) } } }),
	},
	...withArticle({
		produces: "period",
		elements: [token("unit"), token("of"), phrase("date")],
		build: ([unit, , date]) => ({ kind: "period", unit: unitOf(unit), anchor: { containing: dateOf(date) } }),
	}),
	...withArticle({
		produces: "sequence",
		elements: [token("unit"), token("of"), phrase("period")],
		build: ([unit, , period]) => ({ kind: "within", unit: unitOf(unit), period: periodOf(period) }),
	}),
	...rangeShapes,
	...countShapes,
	...everyShapes,
	...weekdayListShapes,
];

export const es: Language = { id: "es", lexicon, shapes, hintWords: { plain: ["cada", "otro", "miércoles", "durante", "veces", "2", "5"], singularUnits: ["día", "semana", "mes"], pluralUnits: ["días", "semanas", "meses"] } };
