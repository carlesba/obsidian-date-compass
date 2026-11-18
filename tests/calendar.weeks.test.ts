import { test } from "node:test";
import { strict as assert } from "node:assert";
import { addDays, isoDate } from "../src/parse/calendar.ts";
import type { CivilDate } from "../src/parse/calendar.ts";
import { ISO_WEEK_RULE, SUNDAY_WEEK_RULE, weekFormatKind, weekNumber, weekRuleOf, weekStartDisagreesWithFormat } from "../src/calendar/weeks.ts";
import type { WeekRule } from "../src/calendar/weeks.ts";
import { moment } from "./moment.ts";

const SATURDAY_LOCALE: WeekRule = { firstDayOfWeek: 6, firstDayOfYear: 12 };

function civil(text: string): CivilDate {
	const [year, month, day] = text.split("-").map(Number);
	return { year, month, day };
}

test("the week start setting chooses the ISO rule, the Sunday rule or the locale's own rule", () => {
	assert.deepEqual(weekRuleOf("monday", SATURDAY_LOCALE), { firstDayOfWeek: 1, firstDayOfYear: 4 });
	assert.deepEqual(weekRuleOf("sunday", SATURDAY_LOCALE), { firstDayOfWeek: 0, firstDayOfYear: 6 });
	assert.deepEqual(weekRuleOf("locale", SATURDAY_LOCALE), SATURDAY_LOCALE);
	assert.notEqual(weekRuleOf("monday", SATURDAY_LOCALE), ISO_WEEK_RULE);
});

const ISO_WEEKS: [string, number][] = [
	["2021-01-03", 53],
	["2021-01-04", 1],
	["2024-12-29", 52],
	["2024-12-30", 1],
	["2026-01-01", 1],
	["2026-11-17", 47],
	["2026-12-31", 53],
	["2027-01-03", 53],
	["2027-01-04", 1],
];

for (const [date, week] of ISO_WEEKS) {
	test(`${date} is ISO week ${week}`, () => {
		assert.equal(weekNumber(civil(date), ISO_WEEK_RULE), week);
	});
}

const SUNDAY_WEEKS: [string, number][] = [
	["2023-12-30", 52],
	["2023-12-31", 1],
	["2022-01-01", 1],
	["2022-01-02", 2],
	["2026-11-15", 47],
	["2026-12-27", 1],
];

for (const [date, week] of SUNDAY_WEEKS) {
	test(`${date} is week ${week} when weeks start on Sunday`, () => {
		assert.equal(weekNumber(civil(date), SUNDAY_WEEK_RULE), week);
	});
}

test("week numbers match moment for every day of twelve years under the ISO and Sunday rules", () => {
	let date = civil("2018-12-20");
	const last = isoDate(civil("2031-01-15"));
	while (isoDate(date) !== last) {
		const day = moment(isoDate(date), "YYYY-MM-DD", true);
		assert.equal(weekNumber(date, ISO_WEEK_RULE), day.isoWeek(), `ISO ${isoDate(date)}`);
		assert.equal(weekNumber(date, SUNDAY_WEEK_RULE), day.week(), `Sunday ${isoDate(date)}`);
		date = addDays(date, 1);
	}
});

test("a Saturday-start locale numbers the week of 1 January as week 1", () => {
	assert.equal(weekNumber(civil("2026-01-01"), SATURDAY_LOCALE), 1);
	assert.equal(weekNumber(civil("2025-12-27"), SATURDAY_LOCALE), 1);
	assert.equal(weekNumber(civil("2025-12-26"), SATURDAY_LOCALE), 52);
	assert.equal(weekNumber(civil("2026-01-03"), SATURDAY_LOCALE), 2);
});

test("a week format is ISO, locale or neither by its tokens, ignoring escaped text", () => {
	assert.equal(weekFormatKind("GGGG-[W]WW"), "iso");
	assert.equal(weekFormatKind("gggg-[W]ww"), "locale");
	assert.equal(weekFormatKind("YYYY-[W]WW"), "iso");
	assert.equal(weekFormatKind("YYYY-[Week] w"), "locale");
	assert.equal(weekFormatKind("YYYY-MM-DD"), "none");
	assert.equal(weekFormatKind("YYYY-[Wgw]"), "none");
});

test("the week start disagrees with an ISO format unless weeks are ISO, and with a locale format unless it is the locale's", () => {
	assert.equal(weekStartDisagreesWithFormat(ISO_WEEK_RULE, "GGGG-[W]WW", SUNDAY_WEEK_RULE), false);
	assert.equal(weekStartDisagreesWithFormat(SUNDAY_WEEK_RULE, "GGGG-[W]WW", SUNDAY_WEEK_RULE), true);
	assert.equal(weekStartDisagreesWithFormat({ firstDayOfWeek: 1, firstDayOfYear: 7 }, "GGGG-[W]WW", SUNDAY_WEEK_RULE), true);
	assert.equal(weekStartDisagreesWithFormat(SUNDAY_WEEK_RULE, "gggg-[W]ww", SUNDAY_WEEK_RULE), false);
	assert.equal(weekStartDisagreesWithFormat(ISO_WEEK_RULE, "gggg-[W]ww", SUNDAY_WEEK_RULE), true);
	assert.equal(weekStartDisagreesWithFormat(ISO_WEEK_RULE, "gggg-[W]ww", ISO_WEEK_RULE), false);
	assert.equal(weekStartDisagreesWithFormat(SUNDAY_WEEK_RULE, "YYYY-MM-DD", ISO_WEEK_RULE), false);
});
