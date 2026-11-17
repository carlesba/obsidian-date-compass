import { test } from "node:test";
import { strict as assert } from "node:assert";
import { dateOf, nearestDateNote, notePath } from "../src/dateNotes/paths.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { Period, PeriodSettingsByPeriod } from "../src/dateNotes/periods.ts";
import { moment } from "./moment.ts";

function periods(change: (periods: PeriodSettingsByPeriod) => void = () => {}): PeriodSettingsByPeriod {
	const settings = defaultDateNotes().periods;
	settings.quarter.enabled = true;
	change(settings);
	return settings;
}

const TODAY = moment("2026-11-17", "YYYY-MM-DD", true);

const ROWS: { period: Period; path: string; start: string }[] = [
	{ period: "day", path: "2026-11-17.md", start: "2026-11-17" },
	{ period: "week", path: "2026-W47.md", start: "2026-11-16" },
	{ period: "month", path: "2026-11.md", start: "2026-11-01" },
	{ period: "quarter", path: "2026-Q4.md", start: "2026-10-01" },
	{ period: "year", path: "2026.md", start: "2026-01-01" },
];

for (const { period, path, start } of ROWS) {
	test(`the ${period} note of 2026-11-17 is ${path}, and ${path} reads back as that ${period}`, () => {
		assert.equal(notePath(TODAY, period, periods()), path);
		const note = dateOf(path, periods(), moment);
		assert.equal(note?.period, period);
		assert.equal(note?.date.format("YYYY-MM-DD"), start);
	});
}

test("nested folders and slashes in the format resolve in both directions", () => {
	const nested = periods((settings) => {
		settings.day.folder = "journal/daily";
		settings.day.format = "YYYY/MM/YYYY-MM-DD";
		settings.week.folder = "journal/weekly";
	});
	assert.equal(notePath(TODAY, "day", nested), "journal/daily/2026/11/2026-11-17.md");
	assert.equal(notePath(TODAY, "week", nested), "journal/weekly/2026-W47.md");
	assert.equal(dateOf("journal/daily/2026/11/2026-11-17.md", nested, moment)?.date.format("YYYY-MM-DD"), "2026-11-17");
	assert.equal(dateOf("journal/weekly/2026-W47.md", nested, moment)?.period, "week");
	assert.equal(dateOf("journal/2026-11-17.md", nested, moment), undefined);
	assert.equal(dateOf("journal/daily/2026-11-17.md", nested, moment), undefined);
});

test("paths that are not date notes, or belong to a disabled period, have no date", () => {
	assert.equal(dateOf("notes/2026-11-17.md", periods((settings) => (settings.day.folder = "on")), moment), undefined);
	assert.equal(dateOf("2026-11-17.txt", periods(), moment), undefined);
	assert.equal(dateOf("Meeting notes.md", periods(), moment), undefined);
	assert.equal(dateOf("2026-13-01.md", periods(), moment), undefined);
	assert.equal(dateOf("2026-Q4.md", defaultDateNotes().periods, moment), undefined);
});

test("next and previous go to the nearest existing note of the same period", () => {
	const settings = periods();
	const paths = ["2026-11-10.md", "2026-11-17.md", "2026-11-20.md", "2026-11-30.md", "2026-W48.md", "2026-11.md", "notes.md"];
	const current = dateOf("2026-11-17.md", settings, moment)!;
	assert.equal(nearestDateNote(current, 1, paths, settings, moment), "2026-11-20.md");
	assert.equal(nearestDateNote(current, -1, paths, settings, moment), "2026-11-10.md");
	const last = dateOf("2026-11-30.md", settings, moment)!;
	assert.equal(nearestDateNote(last, 1, paths, settings, moment), undefined);
	const week = dateOf("2026-W47.md", settings, moment)!;
	assert.equal(nearestDateNote(week, 1, paths, settings, moment), "2026-W48.md");
});

test("a locale week format reads back as the locale's first day of that week", () => {
	const localeWeeks = periods((settings) => (settings.week.format = "gggg-[W]ww"));
	assert.equal(notePath(TODAY, "week", localeWeeks), "2026-W47.md");
	assert.equal(dateOf("2026-W47.md", localeWeeks, moment)?.date.format("ddd YYYY-MM-DD"), "Sun 2026-11-15");
});
