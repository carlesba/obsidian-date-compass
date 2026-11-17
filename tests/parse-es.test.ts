import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_PARSE_OPTIONS, SEQUENCE_LIMIT, complete, itemsOf, parse, parseWithRefusals, type Interpretation, type ParseOptions, type Span } from "../src/parse/index.ts";

const NOW = new Date(2026, 10, 17, 12, 0);

const SPANISH: Partial<ParseOptions> = { languages: ["es"] };
const MONDAY: Partial<ParseOptions> = { ...SPANISH, weekStart: "monday" };
const SUNDAY: Partial<ParseOptions> = { ...SPANISH, weekStart: "sunday" };
const NEXT_OCCURRENCE: Partial<ParseOptions> = { ...SPANISH, nextWeekday: "nextOccurrence" };

interface Summary {
	kind: "single" | "sequence";
	unit: Span["unit"];
	starts: string[];
	end: string;
}

interface Row {
	input: string;
	expected: Summary;
	options?: Partial<ParseOptions>;
}

function summaryOf(interpretation: Interpretation): Summary {
	const result = interpretation.result;
	return { kind: result.kind, unit: result.span.unit, starts: itemsOf(result).map((item) => item.start), end: result.span.end };
}

function summaries(input: string, options: Partial<ParseOptions> = SPANISH): Summary[] {
	return parse(input, NOW, { ...DEFAULT_PARSE_OPTIONS, ...options }).map(summaryOf);
}

function day(date: string): Summary {
	return { kind: "single", unit: "day", starts: [date], end: date };
}

function period(unit: Span["unit"], start: string, end: string): Summary {
	return { kind: "single", unit, starts: [start], end };
}

function shift(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

function dayRun(from: string, count: number): Summary {
	const starts = Array.from({ length: count }, (_, index) => shift(from, index));
	return { kind: "sequence", unit: "day", starts, end: starts[starts.length - 1] };
}

function dates(starts: string[]): Summary {
	return { kind: "sequence", unit: "day", starts, end: starts[starts.length - 1] };
}

function weeks(starts: string[]): Summary {
	return { kind: "sequence", unit: "week", starts, end: shift(starts[starts.length - 1], 6) };
}

const semantics: Row[] = [
	{ input: "hoy", expected: day("2026-11-17") },
	{ input: "mañana", expected: day("2026-11-18") },
	{ input: "ayer", expected: day("2026-11-16") },
	{ input: "pasado mañana", expected: day("2026-11-19") },
	{ input: "anteayer", expected: day("2026-11-15") },
	{ input: "miércoles", expected: day("2026-11-18") },
	{ input: "mié", expected: day("2026-11-18") },
	{ input: "el miércoles", expected: day("2026-11-18") },
	{ input: "este miércoles", expected: day("2026-11-18"), options: MONDAY },
	{ input: "este miércoles", expected: day("2026-11-18"), options: SUNDAY },
	{ input: "este domingo", expected: day("2026-11-22"), options: MONDAY },
	{ input: "este domingo", expected: day("2026-11-15"), options: SUNDAY },
	{ input: "el próximo miércoles", expected: day("2026-11-25"), options: MONDAY },
	{ input: "el próximo miércoles", expected: day("2026-11-25"), options: SUNDAY },
	{ input: "el próximo miércoles", expected: day("2026-11-18"), options: NEXT_OCCURRENCE },
	{ input: "próximo miércoles", expected: day("2026-11-25") },
	{ input: "miércoles que viene", expected: day("2026-11-25"), options: MONDAY },
	{ input: "miércoles que viene", expected: day("2026-11-25"), options: SUNDAY },
	{ input: "miércoles que viene", expected: day("2026-11-18"), options: NEXT_OCCURRENCE },
	{ input: "el miércoles que viene", expected: day("2026-11-25") },
	{ input: "el miércoles próximo", expected: day("2026-11-25") },
	{ input: "el miércoles pasado", expected: day("2026-11-11") },
	{ input: "miércoles pasado", expected: day("2026-11-11") },
	{ input: "hace 3 días", expected: day("2026-11-14") },
	{ input: "hace 3d", expected: day("2026-11-14") },
	{ input: "hace3días", expected: day("2026-11-14") },
	{ input: "hace tres días", expected: day("2026-11-14") },
	{ input: "-3d", expected: day("2026-11-14") },
	{ input: "en 3 días", expected: day("2026-11-20") },
	{ input: "en una semana", expected: day("2026-11-24") },
	{ input: "dentro de una semana", expected: day("2026-11-24") },
	{ input: "+1sem", expected: day("2026-11-24") },
	{ input: "1 semana", expected: day("2026-11-24") },
	{ input: "en 40 días", expected: day("2026-12-27") },
	{ input: "dentro de 40 días", expected: day("2026-12-27") },
	{ input: "40d", expected: day("2026-12-27") },
	{ input: "3 de diciembre", expected: day("2026-12-03") },
	{ input: "el 3 de diciembre", expected: day("2026-12-03") },
	{ input: "3 dic", expected: day("2026-12-03") },
	{ input: "dic 3", expected: day("2026-12-03") },
	{ input: "3 de diciembre de 2027", expected: day("2027-12-03") },
	{ input: "3/12", expected: day("2026-12-03") },
	{ input: "3/12", expected: day("2026-03-12"), options: { ...SPANISH, dayMonthOrder: "monthDay" } },
	{ input: "esta semana", expected: period("week", "2026-11-16", "2026-11-22"), options: MONDAY },
	{ input: "esta semana", expected: period("week", "2026-11-15", "2026-11-21"), options: SUNDAY },
	{ input: "la semana que viene", expected: period("week", "2026-11-23", "2026-11-29"), options: MONDAY },
	{ input: "la semana que viene", expected: period("week", "2026-11-22", "2026-11-28"), options: SUNDAY },
	{ input: "la próxima semana", expected: period("week", "2026-11-23", "2026-11-29"), options: MONDAY },
	{ input: "la próxima semana", expected: period("week", "2026-11-22", "2026-11-28"), options: SUNDAY },
	{ input: "la semana pasada", expected: period("week", "2026-11-09", "2026-11-15"), options: MONDAY },
	{ input: "la semana pasada", expected: period("week", "2026-11-08", "2026-11-14"), options: SUNDAY },
	{ input: "W50", expected: period("week", "2026-12-07", "2026-12-13"), options: MONDAY },
	{ input: "W50", expected: period("week", "2026-12-06", "2026-12-12"), options: SUNDAY },
	{ input: "este mes", expected: period("month", "2026-11-01", "2026-11-30") },
	{ input: "el mes pasado", expected: period("month", "2026-10-01", "2026-10-31") },
	{ input: "el mes que viene", expected: period("month", "2026-12-01", "2026-12-31") },
	{ input: "marzo", expected: period("month", "2026-03-01", "2026-03-31") },
	{ input: "marzo de 2027", expected: period("month", "2027-03-01", "2027-03-31") },
	{ input: "el próximo trimestre", expected: period("quarter", "2027-01-01", "2027-03-31") },
	{ input: "el trimestre que viene", expected: period("quarter", "2027-01-01", "2027-03-31") },
	{ input: "Q1", expected: period("quarter", "2026-01-01", "2026-03-31") },
	{ input: "el año que viene", expected: period("year", "2027-01-01", "2027-12-31") },
	{ input: "el próximo año", expected: period("year", "2027-01-01", "2027-12-31") },
	{ input: "2027", expected: period("year", "2027-01-01", "2027-12-31") },
	{ input: "la semana del 3 de diciembre", expected: period("week", "2026-11-30", "2026-12-06"), options: MONDAY },
	{ input: "la semana del 3 de diciembre", expected: period("week", "2026-11-29", "2026-12-05"), options: SUNDAY },
];

const todayToFriday = dayRun("2026-11-17", 4);
const mondaysAndWednesdays = dates(["2026-11-18", "2026-11-23", "2026-11-25", "2026-11-30", "2026-12-02", "2026-12-07", "2026-12-09", "2026-12-14"]);

const ranges: Row[] = [
	{ input: "de hoy a viernes", expected: todayToFriday },
	{ input: "desde hoy hasta el viernes", expected: todayToFriday },
	{ input: "hoy a viernes", expected: todayToFriday },
	{ input: "hoy - viernes", expected: todayToFriday },
	{ input: "hoy..viernes", expected: todayToFriday },
	{ input: "hoy hasta el viernes", expected: todayToFriday },
	{ input: "del lunes al viernes", expected: dayRun("2026-11-23", 5), options: MONDAY },
	{ input: "del lunes al viernes", expected: dayRun("2026-11-23", 5), options: SUNDAY },
	{ input: "de lunes a viernes", expected: dayRun("2026-11-23", 5) },
	{ input: "del viernes al lunes", expected: dayRun("2026-11-20", 4) },
	{ input: "los próximos 5 días", expected: dayRun("2026-11-17", 5) },
	{ input: "próximos cinco días", expected: dayRun("2026-11-17", 5) },
	{ input: "los últimos 3 días", expected: dayRun("2026-11-15", 3) },
	{ input: "cada lunes y miércoles durante 4 semanas", expected: mondaysAndWednesdays },
	{ input: "cada lunes, miércoles durante 4 semanas", expected: mondaysAndWednesdays },
	{ input: "cada 2 días 5 veces", expected: dates(["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25"]) },
	{ input: "cada 2 días x5", expected: dates(["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-23", "2026-11-25"]) },
	{ input: "cada 2 semanas 5 veces", expected: dates(["2026-11-17", "2026-12-01", "2026-12-15", "2026-12-29", "2027-01-12"]) },
	{ input: "todos los lunes durante 4 semanas", expected: dates(["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]) },
	{ input: "W48 a W50", expected: weeks(["2026-11-23", "2026-11-30", "2026-12-07"]), options: MONDAY },
	{ input: "W48 a W50", expected: weeks(["2026-11-22", "2026-11-29", "2026-12-06"]), options: SUNDAY },
	{ input: "de W48 a W50", expected: weeks(["2026-11-23", "2026-11-30", "2026-12-07"]), options: MONDAY },
	{ input: "de W48 a W50", expected: weeks(["2026-11-22", "2026-11-29", "2026-12-06"]), options: SUNDAY },
	{ input: "las semanas de diciembre", expected: weeks(["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"]), options: MONDAY },
	{ input: "las semanas de diciembre", expected: weeks(["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]), options: SUNDAY },
	{ input: "los meses del próximo trimestre", expected: { kind: "sequence", unit: "month", starts: ["2027-01-01", "2027-02-01", "2027-03-01"], end: "2027-03-31" } },
];

const accentless: Row[] = [
	{ input: "manana", expected: day("2026-11-18") },
	{ input: "pasado manana", expected: day("2026-11-19") },
	{ input: "miercoles", expected: day("2026-11-18") },
	{ input: "el proximo miercoles", expected: day("2026-11-25") },
	{ input: "el sabado pasado", expected: day("2026-11-14") },
	{ input: "hace 3 dias", expected: day("2026-11-14") },
	{ input: "el ano que viene", expected: period("year", "2027-01-01", "2027-12-31") },
	{ input: "los ultimos 3 dias", expected: dayRun("2026-11-15", 3) },
	{ input: "MIÉRCOLES QUE VIENE", expected: day("2026-11-25") },
];

for (const [group, rows] of [["semantics", semantics], ["ranges and sequences", ranges], ["accents", accentless]] as const) {
	for (const row of rows) {
		const label = row.options ? `${row.input} with ${JSON.stringify(row.options)}` : row.input;
		test(`es ${group}: ${label} → ${row.expected.starts[0]}`, () => {
			assert.deepEqual(summaries(row.input, row.options ?? SPANISH), [row.expected]);
		});
	}
}

test("Spanish phrases need Spanish enabled and English phrases need English enabled", () => {
	assert.deepEqual(summaries("el miércoles pasado", { languages: ["en"] }), []);
	assert.deepEqual(summaries("el miércoles pasado", {}), []);
	assert.deepEqual(summaries("last wed", SPANISH), []);
	assert.deepEqual(summaries("next week", SPANISH), []);
	assert.deepEqual(summaries("próximo wed", { languages: ["en", "es"] }), []);
});

for (const input of ["los próximos 367 días", "cada día 400 veces", "cada lunes durante 10 años"]) {
	test(`es: a sequence longer than ${SEQUENCE_LIMIT} items is refused: ${input}`, () => {
		const analysis = parseWithRefusals(input, NOW, { ...DEFAULT_PARSE_OPTIONS, ...SPANISH });
		assert.deepEqual(analysis.interpretations, []);
		assert.deepEqual(
			analysis.refusals.map((refusal) => [refusal.language, refusal.reason, refusal.limit]),
			[["es", "tooManyItems", SEQUENCE_LIMIT]],
		);
	});
}

function languagesAndResults(input: string, languages: string[]): Array<[string, Summary]> {
	return parse(input, NOW, { ...DEFAULT_PARSE_OPTIONS, languages }).map((interpretation) => [interpretation.language, summaryOf(interpretation)]);
}

const march = period("month", "2026-03-01", "2026-03-31");
const tuesday = day("2026-11-24");

test("mar returns every interpretation when English and Spanish are both enabled, in enabled-language order", () => {
	assert.deepEqual(languagesAndResults("mar", ["en", "es"]), [
		["en", march],
		["es", tuesday],
	]);
	assert.deepEqual(languagesAndResults("mar", ["es", "en"]), [
		["es", tuesday],
		["en", march],
	]);
});

test("mar has one interpretation when only one language is enabled", () => {
	assert.deepEqual(languagesAndResults("mar", ["en"]), [["en", march]]);
	assert.deepEqual(languagesAndResults("mar", ["es"]), [["es", tuesday]]);
});

test("words of either language parse when both are enabled", () => {
	assert.deepEqual(languagesAndResults("de hoy a viernes", ["en", "es"]), [["es", todayToFriday]]);
	assert.deepEqual(languagesAndResults("in a week", ["es", "en"]), [["en", day("2026-11-24")]]);
	assert.deepEqual(languagesAndResults("next wed", ["es", "en"]), [["en", day("2026-11-25")]]);
	assert.deepEqual(languagesAndResults("el próximo miércoles", ["en", "es"]), [["es", day("2026-11-25")]]);
});

test("a word meaning the same in both languages gives one interpretation", () => {
	assert.deepEqual(languagesAndResults("3 nov", ["en", "es"]), [["en", day("2026-11-03")]]);
	assert.deepEqual(languagesAndResults("3 nov", ["es", "en"]), [["es", day("2026-11-03")]]);
});

function completionsOf(input: string, languages: string[]): Array<[string, string[]]> {
	return complete(input, NOW, { ...DEFAULT_PARSE_OPTIONS, languages }).map((completion) => [
		completion.text,
		completion.interpretations.map((interpretation) => interpretation.language),
	]);
}

test("prefix completion offers completions from every enabled language", () => {
	assert.deepEqual(completionsOf("ma", ["en"]), [
		["mar", ["en"]],
		["may", ["en"]],
	]);
	assert.deepEqual(completionsOf("ma", ["es"]), [
		["mar", ["es"]],
		["may", ["es"]],
		["marzo", ["es"]],
		["mañana", ["es"]],
	]);
	assert.deepEqual(completionsOf("ma", ["es", "en"]), [
		["mar", ["es", "en"]],
		["may", ["es"]],
		["mayo", ["es"]],
		["march", ["en"]],
		["marzo", ["es"]],
		["mañana", ["es"]],
		["martes", ["es"]],
	]);
});

test("Spanish phrases complete by their last token", () => {
	assert.deepEqual(completionsOf("la semana que v", ["es"]), [["la semana que viene", ["es"]]]);
	assert.deepEqual(completionsOf("pasado ma", ["es"]), [["pasado mañana", ["es"]]]);
	assert.deepEqual(completionsOf("hace 3 dí", ["es"]), [["hace 3 día", ["es"]]]);
	assert.deepEqual(completionsOf("next we", ["en", "es"]), [
		["next wed", ["en"]],
		["next week", ["en"]],
	]);
});
