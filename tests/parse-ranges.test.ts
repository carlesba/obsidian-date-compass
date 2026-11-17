import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_PARSE_OPTIONS, SEQUENCE_LIMIT, complete, itemsOf, parse, parseWithRefusals, type ParseOptions, type Span } from "../src/parse/index.ts";

const NOW = new Date(2026, 10, 17, 12, 0);

const MONDAY: Partial<ParseOptions> = { weekStart: "monday" };
const SUNDAY: Partial<ParseOptions> = { weekStart: "sunday" };

interface Row {
	input: string;
	unit: Span["unit"];
	starts: string[];
	options?: Partial<ParseOptions>;
}

function sequences(input: string, options: Partial<ParseOptions> = {}): Array<{ unit: Span["unit"]; starts: string[] }> {
	return parse(input, NOW, { ...DEFAULT_PARSE_OPTIONS, ...options }).map((interpretation) => {
		const items = itemsOf(interpretation.result);
		return { unit: items[0].unit, starts: items.map((item) => item.start) };
	});
}

function days(from: string, count: number): string[] {
	const start = new Date(`${from}T00:00:00Z`);
	return Array.from({ length: count }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}

const todayToFriday = days("2026-11-17", 4);

const table: Row[] = [
	{ input: "today to fri", unit: "day", starts: todayToFriday },
	{ input: "from today to fri", unit: "day", starts: todayToFriday },
	{ input: "today - fri", unit: "day", starts: todayToFriday },
	{ input: "today..fri", unit: "day", starts: todayToFriday },
	{ input: "today until fri", unit: "day", starts: todayToFriday },
	{ input: "mon to fri", unit: "day", starts: days("2026-11-23", 5), options: MONDAY },
	{ input: "mon to fri", unit: "day", starts: days("2026-11-23", 5), options: SUNDAY },
	{ input: "fri to mon", unit: "day", starts: days("2026-11-20", 4) },
	{ input: "next 5 days", unit: "day", starts: days("2026-11-17", 5) },
	{ input: "last 3 days", unit: "day", starts: days("2026-11-15", 3) },
	{
		input: "every mon, wed for 4 weeks",
		unit: "day",
		starts: ["2026-11-18", "2026-11-23", "2026-11-25", "2026-11-30", "2026-12-02", "2026-12-07", "2026-12-09", "2026-12-14"],
	},
	{ input: "every 2 days x5", unit: "day", starts: ["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25"] },
	{ input: "every 2 weeks 5 times", unit: "day", starts: ["2026-11-17", "2026-12-01", "2026-12-15", "2026-12-29", "2027-01-12"] },
	{ input: "W48 to W50", unit: "week", starts: ["2026-11-23", "2026-11-30", "2026-12-07"], options: MONDAY },
	{ input: "W48 to W50", unit: "week", starts: ["2026-11-22", "2026-11-29", "2026-12-06"], options: SUNDAY },
	{ input: "weeks of december", unit: "week", starts: ["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"], options: MONDAY },
	{ input: "weeks of december", unit: "week", starts: ["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"], options: SUNDAY },
];

const variants: Row[] = [
	{ input: "fri to today", unit: "day", starts: todayToFriday },
	{ input: "dec 3 to nov 20", unit: "day", starts: days("2026-11-20", 14) },
	{ input: "2026-11-20 - 2026-11-17", unit: "day", starts: todayToFriday },
	{ input: "W50 to W48", unit: "week", starts: ["2026-11-23", "2026-11-30", "2026-12-07"] },
	{ input: "from march to may", unit: "month", starts: ["2026-03-01", "2026-04-01", "2026-05-01"] },
	{ input: "Q1..Q2", unit: "quarter", starts: ["2026-01-01", "2026-04-01"] },
	{ input: "today to tue", unit: "day", starts: days("2026-11-17", 8) },
	{ input: "next three days", unit: "day", starts: days("2026-11-17", 3) },
	{ input: "next 3 weeks", unit: "week", starts: ["2026-11-16", "2026-11-23", "2026-11-30"], options: MONDAY },
	{ input: "next 3 weeks", unit: "week", starts: ["2026-11-15", "2026-11-22", "2026-11-29"], options: SUNDAY },
	{ input: "last 2 months", unit: "month", starts: ["2026-10-01", "2026-11-01"] },
	{
		input: "every mon and wed for 4 weeks",
		unit: "day",
		starts: ["2026-11-18", "2026-11-23", "2026-11-25", "2026-11-30", "2026-12-02", "2026-12-07", "2026-12-09", "2026-12-14"],
	},
	{ input: "every monday for 4 weeks", unit: "day", starts: ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"] },
	{ input: "every mon, wed, and fri 4 times", unit: "day", starts: ["2026-11-18", "2026-11-20", "2026-11-23", "2026-11-25"] },
	{ input: "every tue 3 times", unit: "day", starts: ["2026-11-17", "2026-11-24", "2026-12-01"] },
	{ input: "every 2 days x 5", unit: "day", starts: ["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25"] },
	{ input: "every day for 1 week", unit: "day", starts: days("2026-11-17", 7) },
	{ input: "every 2 days for 1 week", unit: "day", starts: ["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23"] },
	{ input: "every month 3 times", unit: "day", starts: ["2026-11-17", "2026-12-17", "2027-01-17"] },
	{ input: "months of next quarter", unit: "month", starts: ["2027-01-01", "2027-02-01", "2027-03-01"] },
];

for (const row of [...table, ...variants]) {
	const label = row.options ? `${row.input} with ${JSON.stringify(row.options)}` : row.input;
	test(`ranges and sequences: ${label} → ${row.starts.length} ${row.unit} items from ${row.starts[0]}`, () => {
		assert.deepEqual(sequences(row.input, row.options), [{ unit: row.unit, starts: row.starts }]);
	});
}

test("a range carries its envelope span and every item", () => {
	const [range] = parse("today to fri", NOW);
	assert.equal(range.result.kind, "sequence");
	assert.deepEqual(range.result.span, { unit: "day", start: "2026-11-17", end: "2026-11-20" });
	assert.deepEqual(itemsOf(range.result)[3], { unit: "day", start: "2026-11-20", end: "2026-11-20" });
	const [weeks] = parse("W48 to W50", NOW);
	assert.deepEqual(weeks.result.span, { unit: "week", start: "2026-11-23", end: "2026-12-13" });
	assert.deepEqual(itemsOf(weeks.result)[0], { unit: "week", start: "2026-11-23", end: "2026-11-29" });
});

test("single dates and periods stay single results", () => {
	const [today] = parse("today", NOW);
	assert.deepEqual(today.result, { kind: "single", span: { unit: "day", start: "2026-11-17", end: "2026-11-17" } });
	assert.deepEqual(itemsOf(today.result), [today.result.span]);
	assert.deepEqual(sequences("2026-W48"), [{ unit: "week", starts: ["2026-11-23"] }]);
	assert.equal(parse("2026-W48", NOW)[0].result.kind, "single");
});

test("ranges need ends of the same kind and sequences need a count", () => {
	assert.deepEqual(sequences("today to next week"), []);
	assert.deepEqual(sequences("W48 to march"), []);
	assert.deepEqual(sequences("next 0 days"), []);
	assert.deepEqual(sequences("every 0 days 3 times"), []);
	assert.deepEqual(sequences("every mon"), []);
	assert.deepEqual(sequences("every mon 0 times"), []);
});

test(`a sequence of up to ${SEQUENCE_LIMIT} items is produced`, () => {
	assert.equal(SEQUENCE_LIMIT, 366);
	const [interpretation] = parse("next 366 days", NOW);
	assert.equal(itemsOf(interpretation.result).length, 366);
	assert.equal(itemsOf(parse("days of 2028", NOW)[0].result).length, 366);
	assert.equal(itemsOf(parse("today to 2027-11-17", NOW)[0].result).length, 366);
});

for (const input of ["next 367 days", "every day 400 times", "every mon for 10 years", "every day for 2 years", "today to 2027-11-18", "2027-11-18 to today"]) {
	test(`a sequence longer than ${SEQUENCE_LIMIT} items is refused: ${input}`, () => {
		assert.deepEqual(parse(input, NOW), []);
		const analysis = parseWithRefusals(input, NOW);
		assert.equal(analysis.interpretations.length, 0);
		assert.deepEqual(
			analysis.refusals.map((refusal) => [refusal.reason, refusal.limit]),
			[["tooManyItems", SEQUENCE_LIMIT]],
		);
	});
}

function completionTexts(input: string): string[] {
	return complete(input, NOW).map((completion) => completion.text);
}

test("the last token completes inside range and sequence phrases", () => {
	assert.deepEqual(completionTexts("every mon"), ["every month", "every monday"]);
	assert.deepEqual(complete("every mon", NOW)[1].interpretations, []);
	assert.deepEqual(completionTexts("every mon, we"), ["every mon, wed"]);
	assert.deepEqual(completionTexts("today t"), ["today to"]);
	assert.deepEqual(
		complete("today to fr", NOW).map((completion) => [completion.text, completion.interpretations.length]),
		[["today to fri", 1]],
	);
	assert.deepEqual(completionTexts("next 5 da"), ["next 5 day"]);
});
