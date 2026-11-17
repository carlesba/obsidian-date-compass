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
const everyOtherDayForSixDays = ["2026-11-17", "2026-11-19", "2026-11-21"];
const everyOtherWednesdayForThreeMonths = ["2026-11-18", "2026-12-02", "2026-12-16", "2026-12-30", "2027-01-13", "2027-01-27", "2027-02-10"];
const wednesdayForFiveWeeks = everyWednesdayUntilDecember20;
const everyTwoDaysTenTimes = ["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25", "2026-11-27", "2026-11-29", "2026-12-01", "2026-12-03", "2026-12-05"];

const phrases: Array<[string, string, string[]]> = [
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
	assert.equal(starts("every day until 2027-11-17", "en")[0].length, SEQUENCE_LIMIT);
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

test("a phrase that already parses gets no hints", () => {
	assert.deepEqual(complete("every wed for 5 weeks", NOW, optionsFor("en")), []);
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
	const sundayStart = { ...optionsFor("en"), weekStart: "sunday" };
	const dates = parse("every other sun, mon for 5 weeks", NOW, sundayStart).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
	assert.deepEqual(dates, [["2026-11-29", "2026-11-30", "2026-12-13", "2026-12-14"]]);
});

test("a numeric end date already past this year ends next year", () => {
	const dayFirst = { ...optionsFor("en"), dayMonthOrder: "dayMonth" };
	const [dates] = parse("every wed until 10/11", NOW, dayFirst).map((interpretation) => itemsOf(interpretation.result).map((item) => item.start));
	assert.equal(dates[dates.length - 1], "2027-11-10");
});

test("an end date that is today does not roll to next year", () => {
	assert.deepEqual(starts("every day until nov 17", "en"), [["2026-11-17"]]);
});
