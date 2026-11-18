import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_PARSE_OPTIONS, SEQUENCE_LIMIT, complete, itemsOf, parse, parseWithRefusals, type ParseOptions } from "../src/parse/index.ts";

const NOW = new Date(2026, 10, 17, 12, 0);

function optionsFor(language: string): ParseOptions {
	return { ...DEFAULT_PARSE_OPTIONS, languages: [language] };
}

function starts(input: string, language: string): string[][] {
	return parse(input, NOW, optionsFor(language)).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
}

const everyWednesdayUntilDecember20 = ["2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09", "2026-12-16"];
const everyOtherDayForSixDays = ["2026-11-19", "2026-11-21", "2026-11-23"];
const everyOtherWednesdayForThreeMonths = ["2026-11-18", "2026-12-02", "2026-12-16", "2026-12-30", "2027-01-13", "2027-01-27", "2027-02-10"];
const wednesdayForFiveWeeks = everyWednesdayUntilDecember20;
const everyTwoDaysTenTimes = ["2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25", "2026-11-27", "2026-11-29", "2026-12-01", "2026-12-03", "2026-12-05", "2026-12-07"];

const weeklyFromNextWeek = ["2026-11-23", "2026-11-30", "2026-12-07"];
const wednesdaysFromNextWeek = ["2026-11-25", "2026-12-02", "2026-12-09"];
const dailyFromDecemberThird = ["2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07"];

const phrases: Array<[string, string, string[]]> = [
	["en", "every week three times starting next week", weeklyFromNextWeek],
	["en", "every week starting next week 3 times", weeklyFromNextWeek],
	["en", "every week 3 times from mon", weeklyFromNextWeek],
	["en", "every wed 3 times starting next week", wednesdaysFromNextWeek],
	["en", "every wed starting next week until dec 9", wednesdaysFromNextWeek],
	["en", "every other wed 3 times starting next week", ["2026-11-25", "2026-12-09", "2026-12-23"]],
	["en", "every day for 5 days starting dec 3", dailyFromDecemberThird],
	["en", "every day from dec 3 until dec 7", dailyFromDecemberThird],
	["en", "every 2 days for 1 week starting on dec 1", ["2026-12-01", "2026-12-03", "2026-12-05", "2026-12-07"]],
	["en", "every month 3 times starting next month", ["2026-12-01", "2027-01-01", "2027-02-01"]],
	["en", "every wed for 4 weeks from tomorrow", ["2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"]],
	["en", "wed for 5 weeks starting next month", ["2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30"]],
	["es", "cada semana tres veces empezando la semana que viene", weeklyFromNextWeek],
	["es", "cada semana a partir de la semana que viene 3 veces", weeklyFromNextWeek],
	["es", "cada semana 3 veces a partir del lunes", weeklyFromNextWeek],
	["es", "cada miércoles 3 veces a partir de la semana que viene", wednesdaysFromNextWeek],
	["es", "cada día durante 5 días desde el 3 de diciembre", dailyFromDecemberThird],
	["es", "cada día desde el 3 de diciembre hasta el 7 de diciembre", dailyFromDecemberThird],
	["es", "cada mes 3 veces comenzando el mes que viene", ["2026-12-01", "2027-01-01", "2027-02-01"]],
	["en", "every wed until dec 20", everyWednesdayUntilDecember20],
	["en", "every other day for 6 days", everyOtherDayForSixDays],
	["en", "every other wed for 3 months", everyOtherWednesdayForThreeMonths],
	["en", "wed for 5 weeks", wednesdayForFiveWeeks],
	["en", "every 2 days for 10 times", everyTwoDaysTenTimes],
	["es", "cada miércoles hasta el 20 de diciembre", everyWednesdayUntilDecember20],
	["es", "cada otro día durante 6 días", everyOtherDayForSixDays],
	["es", "cada otro miércoles durante 3 meses", everyOtherWednesdayForThreeMonths],
	["es", "miércoles durante 5 semanas", wednesdayForFiveWeeks],
	["es", "cada 2 días durante 10 veces", everyTwoDaysTenTimes],
];

for (const [language, input, expected] of phrases) {
	test(`${language}: ${input}`, () => {
		assert.deepEqual(starts(input, language), [expected]);
	});
}

test("until and every other keep the item limit", () => {
	for (const [language, input] of [
		["en", "every day until 2028-01-01"],
		["en", "every other day for 5 years"],
		["es", "cada día hasta 2028-01-01"],
		["es", "cada otro día durante 5 años"],
	]) {
		const analysis = parseWithRefusals(input, NOW, optionsFor(language));
		assert.deepEqual(analysis.interpretations, [], input);
		assert.deepEqual(analysis.refusals.map((refusal) => [refusal.reason, refusal.limit]), [["tooManyItems", SEQUENCE_LIMIT]], input);
	}
	assert.equal(starts("every day until 2027-11-18", "en")[0].length, SEQUENCE_LIMIT);
});

test("an end date in the past gives no sequence", () => {
	assert.deepEqual(starts("every wed until 2026-11-10", "en"), []);
});

const hintInputs: Array<[string, string]> = [
	["en", "every"],
	["en", "every wed"],
	["en", "every 2"],
	["en", "every wed for 5"],
	["en", "every 2 days 10"],
	["en", "wed for 5"],
	["es", "cada"],
	["es", "cada miércoles"],
	["es", "cada 2"],
	["es", "cada miércoles durante 5"],
	["es", "cada 2 días 10"],
	["es", "miércoles durante 5"],
	["en", "every week 3 times starting"],
	["en", "every week 3 times starting next"],
	["es", "cada semana 3 veces empezando"],
	["es", "cada semana 3 veces desde"],
];

for (const [language, input] of hintInputs) {
	test(`${language}: typing "${input}" offers phrases that parse`, () => {
		const hints = complete(input, NOW, optionsFor(language));
		assert.ok(hints.length > 0);
		for (const hint of hints) {
			assert.ok(hint.text.startsWith(input), hint.text);
			assert.ok(hint.interpretations.length > 0, hint.text);
			assert.deepEqual(
				parse(hint.text, NOW, optionsFor(language)).map((interpretation) => interpretation.result),
				hint.interpretations.map((interpretation) => interpretation.result),
				hint.text,
			);
		}
	});
}

test("typing a weekday and a count offers the units", () => {
	assert.deepEqual(
		complete("every wed for 5", NOW, optionsFor("en")).map((hint) => hint.text),
		["every wed for 5 times", "every wed for 5 days", "every wed for 5 weeks", "every wed for 5 months"],
	);
	assert.deepEqual(
		complete("cada miércoles durante 5", NOW, optionsFor("es")).map((hint) => hint.text),
		["cada miércoles durante 5 veces", "cada miércoles durante 5 días", "cada miércoles durante 5 semanas", "cada miércoles durante 5 meses"],
	);
	assert.deepEqual(complete("every 2 days 10", NOW, optionsFor("en")).map((hint) => hint.text), ["every 2 days 10 times"]);
});

test("a sequence with a complete bound offers when to start", () => {
	assert.deepEqual(
		complete("every week 3 times", NOW, optionsFor("en")).map((hint) => [hint.text, hint.interpretations[0].result.span.start]),
		[
			["every week 3 times starting tomorrow", "2026-11-18"],
			["every week 3 times starting next week", "2026-11-23"],
			["every week 3 times starting next month", "2026-12-01"],
		],
	);
	assert.deepEqual(
		complete("cada miércoles durante 5 semanas", NOW, optionsFor("es")).map((hint) => hint.text),
		["cada miércoles durante 5 semanas empezando mañana", "cada miércoles durante 5 semanas empezando la semana que viene", "cada miércoles durante 5 semanas empezando el mes que viene"],
	);
	assert.deepEqual(complete("every week 3 times st", NOW, optionsFor("en")).map((hint) => hint.text), ["every week 3 times starting"]);
	assert.deepEqual(
		complete("every week 3 times starting", NOW, optionsFor("en")).map((hint) => hint.text),
		["every week 3 times starting tomorrow", "every week 3 times starting next week", "every week 3 times starting next month"],
	);
});

test("a phrase that already has a start, or is not a sequence, gets no start hints", () => {
	assert.deepEqual(complete("every week 3 times starting tomorrow", NOW, optionsFor("en")), []);
	assert.deepEqual(complete("today to friday", NOW, optionsFor("en")), []);
	assert.deepEqual(complete("every day for 2 years", NOW, optionsFor("en")), []);
});

test("a start needs a bound, and a started sequence keeps the item limit", () => {
	assert.deepEqual(starts("every week starting next week", "en"), []);
	assert.equal(starts("every day 366 times starting next week", "en")[0].length, SEQUENCE_LIMIT);
	for (const [language, input] of [["en", "every day for 2 years starting tomorrow"], ["en", "every day starting tomorrow until 2028-01-01"], ["es", "cada día durante 2 años empezando mañana"]]) {
		const analysis = parseWithRefusals(input, NOW, optionsFor(language));
		assert.deepEqual(analysis.interpretations, [], input);
		assert.deepEqual(analysis.refusals.map((refusal) => [refusal.reason, refusal.limit]), [["tooManyItems", SEQUENCE_LIMIT]], input);
	}
});

test("step sequences without a start begin one step after today, in every unit", () => {
	for (const [input, first] of [["every day 2 times", "2026-11-18"], ["every 3 days 2 times", "2026-11-20"], ["every week 2 times", "2026-11-24"], ["every other week 2 times", "2026-12-01"], ["every month 2 times", "2026-12-17"], ["every quarter 2 times", "2027-02-17"], ["every year 2 times", "2027-11-17"], ["every day until nov 19", "2026-11-18"]]) {
		assert.equal(starts(input, "en")[0][0], first, input);
	}
	assert.deepEqual(starts("every day until nov 17", "en"), []);
});

test("a yearless end date already past this year ends next year", () => {
	const lateDecember = new Date(2026, 11, 25, 12, 0);
	for (const [language, input] of [["en", "every wed until jan 10"], ["es", "cada miércoles hasta el 10 de enero"]]) {
		const dates = parse(input, lateDecember, optionsFor(language)).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
		assert.deepEqual(dates, [["2026-12-30", "2027-01-06"]], input);
	}
});

test("every other counts weeks from the start of the current week", () => {
	assert.deepEqual(starts("every other mon, wed for 4 weeks", "en"), [["2026-11-18", "2026-11-30", "2026-12-02", "2026-12-14"]]);
});

test("every other counts weeks from the start of the week the settings name", () => {
	const sundayStart: ParseOptions = { ...optionsFor("en"), weekStart: "sunday" as const };
	const dates = parse("every other sun, mon for 5 weeks", NOW, sundayStart).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
	assert.deepEqual(dates, [["2026-11-29", "2026-11-30", "2026-12-13", "2026-12-14"]]);
});

test("a numeric end date already past this year ends next year", () => {
	const dayFirst: ParseOptions = { ...optionsFor("en"), dayMonthOrder: "dayMonth" as const };
	const [dates] = parse("every wed until 10/11", NOW, dayFirst).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
	assert.equal(dates[dates.length - 1], "2027-11-10");
});

test("an end date that is today does not roll to next year", () => {
	assert.deepEqual(starts("every tue until nov 17", "en"), [["2026-11-17"]]);
});
