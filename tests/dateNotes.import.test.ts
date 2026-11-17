import { test } from "node:test";
import { strict as assert } from "node:assert";
import { copyFromSource, dateNoteMismatches, importDateNotes } from "../src/dateNotes/import.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";

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
