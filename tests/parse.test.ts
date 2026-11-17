import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_PARSE_OPTIONS, complete, parse, type ParseOptions, type Span } from "../src/parse/index.ts";

const NOW = new Date(2026, 10, 17, 12, 0);

function noteName(span: Span): string {
	const [year, month] = span.start.split("-").map(Number);
	switch (span.unit) {
		case "day":
			return span.start;
		case "week":
			return isoWeekName(span.start);
		case "month":
			return span.start.slice(0, 7);
		case "quarter":
			return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
		case "year":
			return String(year);
	}
}

function isoWeekName(monday: string): string {
	const thursday = new Date(`${monday}T00:00:00Z`);
	thursday.setUTCDate(thursday.getUTCDate() + 3);
	const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
	firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
	const week = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000)) + 1;
	return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function results(input: string, overrides: Partial<ParseOptions> = {}): string[] {
	return parse(input, NOW, { ...DEFAULT_PARSE_OPTIONS, ...overrides }).map((interpretation) => noteName(interpretation.result.span));
}

interface Row {
	input: string;
	expected: string;
	unit: Span["unit"];
	options?: Partial<ParseOptions>;
}

const semantics: Row[] = [
	{ input: "today", expected: "2026-11-17", unit: "day" },
	{ input: "tmr", expected: "2026-11-18", unit: "day" },
	{ input: "tomorrow", expected: "2026-11-18", unit: "day" },
	{ input: "yest", expected: "2026-11-16", unit: "day" },
	{ input: "yesterday", expected: "2026-11-16", unit: "day" },
	{ input: "wed", expected: "2026-11-18", unit: "day" },
	{ input: "this wed", expected: "2026-11-18", unit: "day" },
	{ input: "next wed", expected: "2026-11-25", unit: "day" },
	{ input: "next wed", expected: "2026-11-18", unit: "day", options: { nextWeekday: "nextOccurrence" } },
	{ input: "last wed", expected: "2026-11-11", unit: "day" },
	{ input: "3daysago", expected: "2026-11-14", unit: "day" },
	{ input: "3d ago", expected: "2026-11-14", unit: "day" },
	{ input: "-3d", expected: "2026-11-14", unit: "day" },
	{ input: "in a week", expected: "2026-11-24", unit: "day" },
	{ input: "+1w", expected: "2026-11-24", unit: "day" },
	{ input: "1 week", expected: "2026-11-24", unit: "day" },
	{ input: "in 40 days", expected: "2026-12-27", unit: "day" },
	{ input: "40d", expected: "2026-12-27", unit: "day" },
	{ input: "dec 3", expected: "2026-12-03", unit: "day" },
	{ input: "3 dec", expected: "2026-12-03", unit: "day" },
	{ input: "december 3rd", expected: "2026-12-03", unit: "day" },
	{ input: "3/12", expected: "2026-12-03", unit: "day" },
	{ input: "3/12", expected: "2026-03-12", unit: "day", options: { dayMonthOrder: "monthDay" } },
	{ input: "this week", expected: "2026-W47", unit: "week" },
	{ input: "next week", expected: "2026-W48", unit: "week" },
	{ input: "last week", expected: "2026-W46", unit: "week" },
	{ input: "W50", expected: "2026-W50", unit: "week" },
	{ input: "this month", expected: "2026-11", unit: "month" },
	{ input: "last month", expected: "2026-10", unit: "month" },
	{ input: "march", expected: "2026-03", unit: "month" },
	{ input: "next quarter", expected: "2027-Q1", unit: "quarter" },
	{ input: "Q1", expected: "2026-Q1", unit: "quarter" },
	{ input: "next year", expected: "2027", unit: "year" },
	{ input: "2027", expected: "2027", unit: "year" },
	{ input: "week of dec 3", expected: "2026-W49", unit: "week" },
];

for (const row of semantics) {
	const label = row.options ? `${row.input} with ${JSON.stringify(row.options)}` : row.input;
	test(`semantics: ${label} → ${row.expected}`, () => {
		const interpretations = parse(row.input, NOW, { ...DEFAULT_PARSE_OPTIONS, ...row.options });
		assert.deepEqual(
			interpretations.map((interpretation) => [interpretation.result.span.unit, noteName(interpretation.result.span)]),
			[[row.unit, row.expected]],
		);
	});
}

const shapes: Array<[string, string]> = [
	["2026-W48", "2026-W48"],
	["2027-Q2", "2027-Q2"],
	["2026-12-03", "2026-12-03"],
	["3/12/2027", "2027-12-03"],
	["dec 3 2027", "2027-12-03"],
	["3rd of december", "2026-12-03"],
	["in 2 weeks", "2026-12-01"],
	["2 months", "2027-01-17"],
	["three days ago", "2026-11-14"],
	["dec 2027", "2027-12"],
	["month of 3/12", "2026-12"],
	["TODAY", "2026-11-17"],
	["  next   wed ", "2026-11-25"],
];

for (const [input, expected] of shapes) {
	test(`shape: ${input} → ${expected}`, () => {
		assert.deepEqual(results(input), [expected]);
	});
}

test("a day offset in weeks or months is a date, not a period", () => {
	const [interpretation] = parse("in 2 weeks", NOW);
	assert.equal(interpretation.result.span.unit, "day");
	assert.equal(interpretation.node.kind, "day");
});

test("a bare weekday equal to today is next week's, and last excludes today", () => {
	assert.deepEqual(results("tue"), ["2026-11-24"]);
	assert.deepEqual(results("this tue"), ["2026-11-17"]);
	assert.deepEqual(results("last tue"), ["2026-11-10"]);
});

test("this <weekday> may be in the past", () => {
	assert.deepEqual(results("this mon"), ["2026-11-16"]);
});

test("week start decides this week and this sunday", () => {
	assert.deepEqual(results("this sun"), ["2026-11-22"]);
	assert.deepEqual(results("this sun", { weekStart: "sunday" }), ["2026-11-15"]);
	assert.deepEqual(results("next sun", { weekStart: "sunday" }), ["2026-11-22"]);
	const [week] = parse("this week", NOW, { ...DEFAULT_PARSE_OPTIONS, weekStart: "sunday" });
	assert.deepEqual(week.result.span, { unit: "week", start: "2026-11-15", end: "2026-11-21" });
	const [monday] = parse("this week", NOW);
	assert.deepEqual(monday.result.span, { unit: "week", start: "2026-11-16", end: "2026-11-22" });
});

test("periods carry their whole span", () => {
	assert.deepEqual(parse("next quarter", NOW)[0].result.span, { unit: "quarter", start: "2027-01-01", end: "2027-03-31" });
	assert.deepEqual(parse("this month", NOW)[0].result.span, { unit: "month", start: "2026-11-01", end: "2026-11-30" });
	assert.deepEqual(parse("2027", NOW)[0].result.span, { unit: "year", start: "2027-01-01", end: "2027-12-31" });
});

test("impossible dates and unknown words give no interpretation", () => {
	assert.deepEqual(results("31/2"), []);
	assert.deepEqual(results("feb 30"), []);
	assert.deepEqual(results("Q5"), []);
	assert.deepEqual(results("W54"), []);
	assert.deepEqual(results("next banana"), []);
	assert.deepEqual(results("next we"), []);
	assert.deepEqual(results("and"), []);
	assert.deepEqual(results(""), []);
});

function completions(input: string): Array<[string, string]> {
	return complete(input, NOW).map((completion) => [completion.text, noteName(completion.interpretations[0].result.span)]);
}

test("the last token completes by prefix: next we → next wed, next week", () => {
	assert.deepEqual(completions("next we"), [
		["next wed", "2026-11-25"],
		["next week", "2026-W48"],
	]);
});

test("completion keeps one spelling per meaning and drops completions that do not parse", () => {
	assert.deepEqual(completions("tod"), [["today", "2026-11-17"]]);
	assert.deepEqual(completions("in 3 da"), [["in 3 day", "2026-11-20"]]);
	assert.deepEqual(completions("dec 3 r"), [["dec 3 rd", "2026-12-03"]]);
	assert.deepEqual(completions("in 3 days a"), []);
});

test("completion reaches inside a run glued to digits", () => {
	assert.deepEqual(completions("3daysa"), [["3daysago", "2026-11-14"]]);
});

test("nothing completes after a space or a digit", () => {
	assert.deepEqual(completions("next "), []);
	assert.deepEqual(completions("dec 3"), []);
});
