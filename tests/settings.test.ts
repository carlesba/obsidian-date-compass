import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import { languageKey, readControl, writeControl } from "../src/settings/controlKeys.ts";

test("a fresh install gets the defaults, with English as the only parser language", () => {
	assert.deepEqual(mergeSettings(undefined), {
		languages: ["en"],
		weekStart: "locale",
		nextWeekday: "nextWeek",
		dayMonthOrder: "dayMonth",
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
	});
});

test("stored values the plugin does not know fall back to the defaults", () => {
	const merged = mergeSettings({ languages: ["es", "fr"], weekStart: "friday", nextWeekday: 3, dayMonthOrder: null });
	assert.deepEqual(merged, { languages: ["es"], weekStart: "locale", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" });
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
