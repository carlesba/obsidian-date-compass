import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import { TEMPLATE_RUNNER_KEY, languageKey, periodKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultDateNotes, mergeDateNotes } from "../src/dateNotes/periods.ts";

test("a fresh install gets the defaults, with English as the only parser language", () => {
	assert.deepEqual(mergeSettings(undefined), {
		languages: ["en"],
		weekStart: "locale",
		nextWeekday: "nextWeek",
		dayMonthOrder: "dayMonth",
		dateNotes: {
			imported: false,
			templateRunner: "automatic",
			periods: {
				day: { enabled: true, folder: "", format: "YYYY-MM-DD", template: "" },
				week: { enabled: true, folder: "", format: "GGGG-[W]WW", template: "" },
				month: { enabled: true, folder: "", format: "YYYY-MM", template: "" },
				quarter: { enabled: false, folder: "", format: "YYYY-[Q]Q", template: "" },
				year: { enabled: true, folder: "", format: "YYYY", template: "" },
			},
		},
	});
});

test("a Spanish interface turns on Spanish and English by default", () => {
	assert.deepEqual(defaultSettings("es").languages, ["es", "en"]);
	assert.deepEqual(defaultSettings("fr").languages, ["en"]);
});

test("stored partial settings merge over the defaults", () => {
	assert.deepEqual(mergeSettings({ weekStart: "sunday", dayMonthOrder: "monthDay" }), {
		languages: ["en"],
		weekStart: "sunday",
		nextWeekday: "nextWeek",
		dayMonthOrder: "monthDay",
		dateNotes: defaultDateNotes(),
	});
});

test("stored date-note settings merge over the defaults, period by period and field by field", () => {
	const merged = mergeDateNotes({
		imported: true,
		templateRunner: "templater",
		periods: {
			day: { folder: "/on/", format: "DD-MM-YYYY", template: "templates/day.md" },
			quarter: { enabled: true },
			week: { enabled: "yes", format: "  ", folder: 3 },
			decade: { enabled: true },
		},
	});
	assert.deepEqual(merged, {
		imported: true,
		templateRunner: "templater",
		periods: {
			day: { enabled: true, folder: "on", format: "DD-MM-YYYY", template: "templates/day.md" },
			week: { enabled: true, folder: "", format: "GGGG-[W]WW", template: "" },
			month: { enabled: true, folder: "", format: "YYYY-MM", template: "" },
			quarter: { enabled: true, folder: "", format: "YYYY-[Q]Q", template: "" },
			year: { enabled: true, folder: "", format: "YYYY", template: "" },
		},
	});
	assert.deepEqual(mergeDateNotes({ templateRunner: "nunjucks", periods: [] }), defaultDateNotes());
	assert.equal(mergeSettings({ dateNotes: { imported: true } }).dateNotes.imported, true);
});

test("date-note controls read and write each period's fields and the template runner", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, periodKey("quarter", "enabled"), true), true);
	assert.equal(writeControl(settings, periodKey("day", "folder"), "/journal/daily/"), true);
	assert.equal(writeControl(settings, periodKey("day", "format"), " YYYY/MM/YYYY-MM-DD "), true);
	assert.equal(writeControl(settings, periodKey("day", "template"), "templates/day.md"), true);
	assert.equal(writeControl(settings, periodKey("day", "format"), " "), false);
	assert.equal(writeControl(settings, periodKey("day", "enabled"), "yes"), false);
	assert.equal(writeControl(settings, TEMPLATE_RUNNER_KEY, "coreTemplates"), true);
	assert.equal(writeControl(settings, TEMPLATE_RUNNER_KEY, "nunjucks"), false);
	assert.equal(writeControl(settings, "dateNotes/decade/folder", "x"), false);
	assert.deepEqual(settings.dateNotes.periods.day, { enabled: true, folder: "journal/daily", format: "YYYY/MM/YYYY-MM-DD", template: "templates/day.md" });
	assert.equal(readControl(settings, periodKey("quarter", "enabled")), true);
	assert.equal(readControl(settings, periodKey("day", "folder")), "journal/daily");
	assert.equal(readControl(settings, TEMPLATE_RUNNER_KEY), "coreTemplates");
});

test("stored values the plugin does not know fall back to the defaults", () => {
	const merged = mergeSettings({ languages: ["es", "fr"], weekStart: "friday", nextWeekday: 3, dayMonthOrder: null });
	assert.deepEqual(merged, { languages: ["es"], weekStart: "locale", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth", dateNotes: defaultDateNotes() });
	assert.deepEqual(mergeSettings([1, 2]), defaultSettings());
	assert.deepEqual(mergeSettings("broken"), defaultSettings());
});

test("settings controls read and write the settings they name", () => {
	const settings = defaultSettings();
	assert.equal(writeControl(settings, languageKey("es"), true), true);
	assert.deepEqual(settings.languages, ["en", "es"]);
	assert.equal(readControl(settings, languageKey("es")), true);
	assert.equal(writeControl(settings, languageKey("en"), false), true);
	assert.deepEqual(settings.languages, ["es"]);
	assert.equal(writeControl(settings, "weekStart", "monday"), true);
	assert.equal(readControl(settings, "weekStart"), "monday");
	assert.equal(writeControl(settings, "weekStart", "friday"), false);
	assert.equal(writeControl(settings, "unknown", "x"), false);
	assert.equal(readControl(settings, "weekStart"), "monday");
});
