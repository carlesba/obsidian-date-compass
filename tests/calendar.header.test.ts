import { test } from "node:test";
import { strict as assert } from "node:assert";
import { headerParts } from "../src/calendar/header.ts";
import { dateNotesWithoutQuarter } from "./fixtures.ts";
import type { PeriodSettingsByPeriod } from "../src/dateNotes/periods.ts";

function periods(change: (periods: PeriodSettingsByPeriod) => void = () => {}): PeriodSettingsByPeriod {
	const settings = dateNotesWithoutQuarter().periods;
	change(settings);
	return settings;
}

test("the header shows the month and the year, and leaves the quarter out while quarterly notes are off", () => {
	assert.deepEqual(headerParts({ year: 2026, month: 8 }, "Aug", periods()), [
		{ period: "month", label: "Aug", clickable: true },
		{ period: "year", label: "2026", clickable: true },
	]);
});

test("the quarter sits between the month and the year when quarterly notes are on", () => {
	const withQuarter = periods((settings) => (settings.quarter.enabled = true));
	assert.deepEqual(headerParts({ year: 2026, month: 8 }, "Aug", withQuarter), [
		{ period: "month", label: "Aug", clickable: true },
		{ period: "quarter", label: "Q3", clickable: true },
		{ period: "year", label: "2026", clickable: true },
	]);
	const quarterLabels = [1, 3, 4, 6, 7, 9, 10, 12].map((month) => headerParts({ year: 2026, month }, "", withQuarter)[1].label);
	assert.deepEqual(quarterLabels, ["Q1", "Q1", "Q2", "Q2", "Q3", "Q3", "Q4", "Q4"]);
});

test("the month and the year stay visible but stop being clickable when their period is off", () => {
	const off = periods((settings) => {
		settings.month.enabled = false;
		settings.year.enabled = false;
	});
	assert.deepEqual(headerParts({ year: 2026, month: 8 }, "Aug", off), [
		{ period: "month", label: "Aug", clickable: false },
		{ period: "year", label: "2026", clickable: false },
	]);
});
