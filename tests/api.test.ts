import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Moment } from "moment";
import { moment } from "./moment.ts";
import { createDateCompassApi } from "../src/api/index.ts";
import type { DateCompassApi, DateCompassNote } from "../src/api/index.ts";
import { PERIODS } from "../src/dateNotes/periods.ts";
import type { Period } from "../src/dateNotes/periods.ts";
import { parse } from "../src/parse/index.ts";
import { parseOptionsOf } from "../src/parseOptions.ts";
import { defaultSettings } from "../src/settings.ts";
import type { DateCompassSettings } from "../src/settings.ts";
import { dateNotesEnabling } from "./fixtures.ts";

const NOW = new Date(2026, 10, 17, 12);

interface Fake {
	api: DateCompassApi;
	settings: DateCompassSettings;
	opened: { date: string; period: Period }[];
	ensured: { date: string; period: Period }[];
}

function fakeApi(change: (settings: DateCompassSettings) => void = () => {}, localeFirstDayOfWeek = 1): Fake {
	const settings = defaultSettings();
	settings.weekStart = "monday";
	settings.dateNotes = dateNotesEnabling(PERIODS);
	change(settings);
	const opened: Fake["opened"] = [];
	const ensured: Fake["ensured"] = [];
	const api = createDateCompassApi({
		settings: () => settings,
		parseOptions: () => parseOptionsOf(settings, localeFirstDayOfWeek),
		moment,
		openDateNote: async (date: Moment, period: Period) => {
			opened.push({ date: date.format("YYYY-MM-DD"), period });
		},
		ensureDateNote: async (date: Moment, period: Period) => {
			ensured.push({ date: date.format("YYYY-MM-DD"), period });
			return period === "year" ? undefined : `${date.format("YYYY-MM-DD")}.md`;
		},
	});
	return { api, settings, opened, ensured };
}

const starts = (notes: readonly DateCompassNote[]) => notes.map((note) => note.start);

test("the api exposes exactly parse, resolve, sequence, notePath, dateOf, openNote, periods and ensureNote", () => {
	const { api } = fakeApi();
	assert.deepEqual(Object.keys(api).sort(), ["dateOf", "ensureNote", "notePath", "openNote", "parse", "periods", "resolve", "sequence"]);
	for (const value of Object.values(api)) assert.equal(typeof value, "function");
	assert.ok(Object.isFrozen(api));
});

test("parse returns every interpretation, one per meaning across enabled languages", () => {
	const { api, settings } = fakeApi((settings) => (settings.languages = ["en", "es"]));
	const interpretations = api.parse("mar", NOW);
	assert.equal(interpretations.length, parse("mar", NOW, parseOptionsOf(settings, 1)).length);
	assert.deepEqual(
		interpretations.map(({ language, notes }) => ({ language, notes: notes.map(({ period, start, path }) => ({ period, start, path })) })),
		[
			{ language: "en", notes: [{ period: "month", start: "2026-03-01", path: "2026-03.md" }] },
			{ language: "es", notes: [{ period: "day", start: "2026-11-24", path: "2026-11-24.md" }] },
		],
	);
});

test("resolve returns the first interpretation or undefined", () => {
	const { api } = fakeApi((settings) => (settings.languages = ["en", "es"]));
	assert.deepEqual(api.resolve("mar", NOW), api.parse("mar", NOW)[0]);
	assert.deepEqual(api.resolve("last wed", NOW)?.notes, [{ period: "day", start: "2026-11-11", date: "2026-11-11", name: "2026-11-11", path: "2026-11-11.md" }]);
	assert.equal(api.resolve("hello world", NOW), undefined);
	assert.deepEqual(api.parse("hello world", NOW), []);
});

test("sequence returns the dates of a range or sequence in order, and nothing for text that does not parse", () => {
	const { api } = fakeApi();
	assert.deepEqual(starts(api.sequence("mon to fri", NOW)), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
	assert.deepEqual(starts(api.sequence("every mon for 4 weeks", NOW)), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
	assert.deepEqual(
		api.sequence("every mon for 4 weeks", NOW).map((note) => note.path),
		["2026-11-23.md", "2026-11-30.md", "2026-12-07.md", "2026-12-14.md"],
	);
	assert.deepEqual(starts(api.sequence("today", NOW)), ["2026-11-17"]);
	assert.deepEqual(api.sequence("hello world", NOW), []);
});

test("now defaults to the current time", () => {
	const { api } = fakeApi();
	assert.equal(api.resolve("today")?.notes[0].start, moment().format("YYYY-MM-DD"));
	assert.deepEqual(api.resolve("today", moment("2026-11-17", "YYYY-MM-DD"))?.notes[0].start, "2026-11-17");
});

test("notePath and dateOf round-trip through the configured folder and format of each period", () => {
	const { api } = fakeApi((settings) => {
		settings.dateNotes.periods.day.folder = "journal/daily";
		settings.dateNotes.periods.day.format = "YYYY/MM/YYYY-MM-DD";
		settings.dateNotes.periods.week.folder = "journal/weekly";
		settings.dateNotes.periods.month.format = "MMMM YYYY";
		settings.dateNotes.periods.quarter.folder = "quarters";
		settings.dateNotes.periods.year.folder = "years";
	});
	const expected: Record<Period, { path: string; start: string }> = {
		day: { path: "journal/daily/2026/11/2026-11-17.md", start: "2026-11-17" },
		week: { path: "journal/weekly/2026-W47.md", start: "2026-11-16" },
		month: { path: "November 2026.md", start: "2026-11-01" },
		quarter: { path: "quarters/2026-Q4.md", start: "2026-10-01" },
		year: { path: "years/2026.md", start: "2026-01-01" },
	};
	for (const period of PERIODS) {
		const path = api.notePath("2026-11-17", period);
		assert.equal(path, expected[period].path);
		const note = api.dateOf(path);
		assert.equal(note?.period, period);
		assert.equal(note?.start, expected[period].start);
		assert.equal(note && api.notePath(note.date, note.period), path);
	}
	assert.equal(api.notePath(NOW, "day"), "journal/daily/2026/11/2026-11-17.md");
	assert.equal(api.notePath(moment("2026-11-17", "YYYY-MM-DD"), "week"), "journal/weekly/2026-W47.md");
	assert.equal(api.dateOf("journal/2026-11-17.md"), undefined);
	assert.equal(api.dateOf("journal/daily/2026/11/2026-11-17.txt"), undefined);
});

for (const weekStart of ["monday", "sunday"] as const) {
	test(`dateOf describes a note exactly as parse does, with ${weekStart} weeks and a slashed day format`, () => {
		const { api } = fakeApi((settings) => {
			settings.weekStart = weekStart;
			settings.dateNotes.periods.day.format = "YYYY/MM/YYYY-MM-DD";
			settings.dateNotes.periods.month.folder = "months";
		});
		for (const phrase of ["today", "this week", "next week", "this month", "next quarter", "next year", "W48 to W50"]) {
			const notes = api.resolve(phrase, NOW)?.notes ?? assert.fail(phrase);
			for (const note of notes) assert.deepEqual(api.dateOf(note.path), note, phrase);
		}
	});
}

test("notePath and openNote refuse what is not a date, an unknown period and a period turned off", async () => {
	const { api, opened } = fakeApi((settings) => (settings.dateNotes.periods.quarter.enabled = false));
	for (const date of ["17 Nov", "tomorrow", undefined, null, 0, {}]) {
		assert.throws(() => api.notePath(date as string, "day"), TypeError, String(date));
		await assert.rejects(api.openNote(date as string, "day"), TypeError, String(date));
	}
	assert.throws(() => api.notePath("2026-11-17", "fortnight" as Period), TypeError);
	assert.throws(() => api.notePath("2026-11-17", "quarter"), TypeError);
	await assert.rejects(api.openNote("2026-11-17", "fortnight" as Period), TypeError);
	await assert.rejects(api.openNote("2026-11-17", "quarter"), TypeError);
	assert.deepEqual(opened, []);
	assert.equal(api.dateOf("2026-Q4.md"), undefined);
});

test("every note parse returns names its own path", () => {
	const { api } = fakeApi((settings) => (settings.weekStart = "sunday"));
	for (const phrase of ["today", "this week", "next week", "this month", "next quarter", "next year", "W48 to W50"]) {
		for (const note of api.resolve(phrase, NOW)?.notes ?? assert.fail(phrase)) assert.equal(api.notePath(note.date, note.period), note.path, phrase);
	}
});

test("a Spanish phrase parses only when Spanish is enabled", () => {
	const english = fakeApi((settings) => (settings.languages = ["en"])).api;
	const both = fakeApi((settings) => (settings.languages = ["es", "en"])).api;
	assert.equal(english.resolve("el próximo miércoles", NOW), undefined);
	assert.equal(english.resolve("dentro de 3 días", NOW), undefined);
	assert.equal(both.resolve("el próximo miércoles", NOW)?.notes[0].start, "2026-11-25");
	assert.equal(both.resolve("dentro de 3 días", NOW)?.notes[0].start, "2026-11-20");
});

test("the week start of the settings decides where weeks begin", () => {
	assert.deepEqual(starts(fakeApi().api.sequence("this week", NOW)), ["2026-11-16"]);
	assert.deepEqual(starts(fakeApi((settings) => (settings.weekStart = "sunday")).api.sequence("this week", NOW)), ["2026-11-15"]);
	assert.deepEqual(starts(fakeApi((settings) => (settings.weekStart = "locale"), 0).api.sequence("this week", NOW)), ["2026-11-15"]);
	assert.equal(fakeApi((settings) => (settings.weekStart = "sunday")).api.resolve("this week", NOW)?.notes[0].path, "2026-W47.md");
});

test("the day/month order and the next-weekday meaning follow the settings", () => {
	assert.equal(fakeApi().api.resolve("3/12", NOW)?.notes[0].start, "2026-12-03");
	assert.equal(fakeApi((settings) => (settings.dayMonthOrder = "monthDay")).api.resolve("3/12", NOW)?.notes[0].start, "2026-03-12");
	assert.equal(fakeApi((settings) => (settings.nextWeekday = "nextOccurrence")).api.resolve("next wed", NOW)?.notes[0].start, "2026-11-18");
});

test("a phrase for a disabled period has no interpretation", () => {
	const { api } = fakeApi((settings) => (settings.dateNotes.periods.quarter.enabled = false));
	assert.equal(api.resolve("next quarter", NOW), undefined);
});

test("openNote calls the open-or-create path with the date and period", async () => {
	const { api, opened } = fakeApi();
	await api.openNote("2026-12-01", "month");
	await api.openNote(NOW, "day");
	assert.deepEqual(opened, [
		{ date: "2026-12-01", period: "month" },
		{ date: "2026-11-17", period: "day" },
	]);
	await api.openNote(moment("2026-11-23", "YYYY-MM-DD"), "week");
	assert.deepEqual(opened[2], { date: "2026-11-23", period: "week" });
});

test("phrases with no words report the shared language, and languages keep their enabled order", () => {
	const { api } = fakeApi((settings) => (settings.languages = ["es", "en"]));
	assert.deepEqual(["W50", "-3d", "2027", "3/12"].map((phrase) => api.resolve(phrase, NOW)?.language), ["shared", "shared", "shared", "shared"]);
	assert.deepEqual(api.parse("mar", NOW).map((reading) => reading.language), ["es", "en"]);
});

test("parse offers no completions, nothing for blank text, and nothing past the sequence limit", () => {
	const { api } = fakeApi();
	assert.deepEqual(api.parse("next we", NOW), []);
	assert.deepEqual(api.parse("   ", NOW), []);
	assert.deepEqual(api.sequence("every day for 400 days", NOW), []);
	assert.equal(api.sequence("every day for 300 days", NOW).length, 300);
});

test("parse ignores the targets of the mentions and reads every period phrase of the manual", () => {
	const { api } = fakeApi((settings) => {
		for (const mention of settings.mentions) mention.targets = ["year"];
	});
	assert.equal(api.resolve("today", NOW)?.notes[0].path, "2026-11-17.md");
	assert.equal(api.resolve("2026-Q1", NOW)?.notes[0].path, "2026-Q1.md");
	assert.equal(api.resolve("next month", NOW)?.notes[0].path, "2026-12.md");
});

test("periods reports a frozen copy of every period's enabled switch, folder and format, without the template", () => {
	const { api, settings } = fakeApi((settings) => {
		settings.dateNotes.periods.quarter.enabled = false;
		settings.dateNotes.periods.day.folder = "Daily";
	});
	const periods = api.periods();
	assert.deepEqual(periods.day, { enabled: true, folder: "Daily", format: "YYYY-MM-DD" });
	assert.deepEqual(periods.quarter, { enabled: false, folder: "", format: "YYYY-[Q]Q" });
	assert.deepEqual(Object.keys(periods), ["day", "week", "month", "quarter", "year"]);
	assert.ok(Object.isFrozen(periods));
	assert.ok(Object.values(periods).every((period) => Object.isFrozen(period)));
	settings.dateNotes.periods.day.folder = "Journal";
	assert.equal(periods.day.folder, "Daily");
	assert.equal(api.periods().day.folder, "Journal");
});

test("ensureNote creates through the date-note path without opening, and refuses bad dates and turned-off periods", async () => {
	const { api, opened, ensured } = fakeApi((settings) => (settings.dateNotes.periods.quarter.enabled = false));
	assert.equal(await api.ensureNote("2026-12-01", "day"), "2026-12-01.md");
	assert.equal(await api.ensureNote(NOW, "year"), undefined);
	assert.deepEqual(ensured, [
		{ date: "2026-12-01", period: "day" },
		{ date: "2026-11-17", period: "year" },
	]);
	assert.deepEqual(opened, []);
	await assert.rejects(api.ensureNote("2026-12-01", "quarter"), /quarter notes are turned off/);
	await assert.rejects(api.ensureNote("not a date", "day"), /is not a date/);
	await assert.rejects(api.ensureNote("2026-12-01", "decade" as Period), /is not a period/);
});
