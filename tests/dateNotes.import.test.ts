import { test } from "node:test";
import { strict as assert } from "node:assert";
import { copyFromSource, dateNoteMismatches, importDateNotes } from "../src/dateNotes/import.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import { mismatchDescription } from "../src/settings/dateNotesPage.ts";
import { DEFAULT_LANGUAGE, setLanguage } from "../src/i18n/index.ts";

const PERIODIC_NOTES = {
	showGettingStartedBanner: false,
	daily: { format: "", template: "templates/day", folder: "on", enabled: true },
	weekly: { format: "GGGG-[W]WW", folder: "on/", template: "", enabled: true },
	monthly: { format: "", template: "", folder: "on", enabled: true },
	quarterly: { format: "", template: "templates/quarter.md", folder: "on", enabled: true },
	yearly: { format: "", template: "", folder: "", enabled: false },
};

const DAILY_NOTES = { folder: "journal", format: "DD-MM-YYYY", template: "templates/daily", autorun: false };

test("the first load imports every period from Periodic Notes, with its defaults for empty formats", () => {
	const settings = defaultDateNotes();
	assert.equal(importDateNotes(settings, { periodicNotes: PERIODIC_NOTES, dailyNotes: DAILY_NOTES }), "periodicNotes");
	assert.equal(settings.imported, true);
	assert.deepEqual(settings.periods, {
		day: { enabled: true, folder: "on", format: "YYYY-MM-DD", template: "templates/day.md" },
		week: { enabled: true, folder: "on", format: "GGGG-[W]WW", template: "" },
		month: { enabled: true, folder: "on", format: "YYYY-MM", template: "" },
		quarter: { enabled: true, folder: "on", format: "YYYY-[Q]Q", template: "templates/quarter.md" },
		year: { enabled: false, folder: "", format: "YYYY", template: "" },
	});
});

test("without Periodic Notes, only the day period is imported from core Daily notes", () => {
	const settings = defaultDateNotes();
	assert.equal(importDateNotes(settings, { dailyNotes: DAILY_NOTES }), "dailyNotes");
	assert.deepEqual(settings.periods.day, { enabled: true, folder: "journal", format: "DD-MM-YYYY", template: "templates/daily.md" });
	assert.deepEqual(settings.periods.week, defaultDateNotes().periods.week);
});

test("the import runs once: later loads keep what the plugin owns", () => {
	const settings = defaultDateNotes();
	assert.equal(importDateNotes(settings, {}), undefined);
	assert.equal(settings.imported, true);
	assert.deepEqual(settings.periods, defaultDateNotes().periods);
	assert.equal(importDateNotes(settings, { periodicNotes: PERIODIC_NOTES }), undefined);
	assert.deepEqual(settings.periods, defaultDateNotes().periods);
});

test("a Periodic Notes shape without any period is not a source", () => {
	const settings = defaultDateNotes();
	assert.equal(importDateNotes(settings, { periodicNotes: { showGettingStartedBanner: true }, dailyNotes: DAILY_NOTES }), "dailyNotes");
});

test("matching settings show no notice", () => {
	const settings = defaultDateNotes();
	importDateNotes(settings, { periodicNotes: PERIODIC_NOTES });
	assert.deepEqual(dateNoteMismatches(settings, { periodicNotes: PERIODIC_NOTES }), []);
});

test("different folders or formats in enabled periods of either source are reported", () => {
	const settings = defaultDateNotes();
	settings.imported = true;
	settings.periods.day.folder = "daily";
	const mismatches = dateNoteMismatches(settings, { periodicNotes: PERIODIC_NOTES, dailyNotes: DAILY_NOTES });
	assert.deepEqual(
		mismatches.map(({ source, differences }) => ({ source, differences: differences.map(({ period, field, theirs, ours }) => `${period}.${field}: ${theirs} vs ${ours}`) })),
		[
			{
				source: "periodicNotes",
				differences: ["day.folder: on vs daily", "week.folder: on vs ", "month.folder: on vs ", "quarter.folder: on vs "],
			},
			{ source: "dailyNotes", differences: ["day.folder: journal vs daily", "day.format: DD-MM-YYYY vs YYYY-MM-DD"] },
		],
	);
});

test("the copy button copies the other plugin's folders and formats in, and nothing else", () => {
	const settings = defaultDateNotes();
	settings.periods.day.template = "mine.md";
	settings.templateRunner = "coreTemplates";
	assert.equal(copyFromSource(settings, "dailyNotes", { dailyNotes: DAILY_NOTES }), true);
	assert.deepEqual(settings.periods.day, { enabled: true, folder: "journal", format: "DD-MM-YYYY", template: "mine.md" });
	assert.equal(settings.templateRunner, "coreTemplates");
	assert.deepEqual(dateNoteMismatches(settings, { dailyNotes: DAILY_NOTES }), []);
	assert.equal(copyFromSource(settings, "dailyNotes", { dailyNotes: DAILY_NOTES }), false);
	const source = structuredClone(DAILY_NOTES);
	copyFromSource(settings, "periodicNotes", { periodicNotes: PERIODIC_NOTES, dailyNotes: source });
	assert.deepEqual(source, DAILY_NOTES);
});

test("the Periodic Notes 1.0 calendar sets shape imports its active set", () => {
	const settings = defaultDateNotes();
	const data = {
		activeCalendarSet: "work",
		calendarSets: [
			{ id: "default", day: { enabled: true, folder: "home", format: "YYYY-MM-DD" } },
			{ id: "work", day: { enabled: true, folder: "work/days", format: "", templatePath: "templates/work.md" }, week: { enabled: false, format: "GGGG-[W]WW" } },
		],
	};
	assert.equal(importDateNotes(settings, { periodicNotes: data }), "periodicNotes");
	assert.deepEqual(settings.periods.day, { enabled: true, folder: "work/days", format: "YYYY-MM-DD", template: "templates/work.md" });
	assert.deepEqual(settings.periods.week, { enabled: false, folder: "", format: "GGGG-[W]WW", template: "" });
	assert.deepEqual(settings.periods.month, defaultDateNotes().periods.month);
});

test("the notice names each difference, showing an empty folder as the vault root", () => {
	setLanguage(DEFAULT_LANGUAGE);
	const settings = defaultDateNotes();
	const [mismatch] = dateNoteMismatches(settings, { dailyNotes: DAILY_NOTES });
	assert.equal(
		mismatchDescription(mismatch),
		'Calendar and other plugins read those settings, so they look for different notes. Daily notes, Folder: "journal" there, vault root here. Daily notes, Name format: "DD-MM-YYYY" there, "YYYY-MM-DD" here.',
	);
});
