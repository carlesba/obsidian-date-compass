import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultCalendar, mergeCalendar } from "../src/calendar/settings.ts";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import { CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_WORDS_PER_DOT_KEY, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { calendarGroups } from "../src/settings/calendarPage.ts";
import { weekStartMismatchGroup } from "../src/settings/dateNotesPage.ts";

const DEFAULTS = { showWeekNumbers: true, confirmBeforeCreate: true, wordsPerDot: 250 };

test("the calendar shows week numbers, confirms before creating and counts 250 words per dot by default", () => {
	assert.deepEqual(defaultCalendar(), DEFAULTS);
	assert.deepEqual(mergeCalendar(undefined), DEFAULTS);
	assert.deepEqual(mergeCalendar("broken"), DEFAULTS);
	assert.deepEqual(mergeCalendar([true, false, 3]), DEFAULTS);
});

test("stored calendar settings merge over the defaults field by field", () => {
	assert.deepEqual(mergeCalendar({ showWeekNumbers: false }), { ...DEFAULTS, showWeekNumbers: false });
	assert.deepEqual(mergeCalendar({ confirmBeforeCreate: false, wordsPerDot: 100 }), { showWeekNumbers: true, confirmBeforeCreate: false, wordsPerDot: 100 });
	assert.deepEqual(mergeCalendar({ showWeekNumbers: "no", confirmBeforeCreate: 0 }), DEFAULTS);
	assert.deepEqual(mergeSettings({ calendar: { wordsPerDot: 40 } }).calendar, { ...DEFAULTS, wordsPerDot: 40 });
});

test("words per dot is a whole number from 0 up, and anything else falls back to 250", () => {
	assert.equal(mergeCalendar({ wordsPerDot: 0 }).wordsPerDot, 0);
	assert.equal(mergeCalendar({ wordsPerDot: 1 }).wordsPerDot, 1);
	for (const invalid of [-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "100", null]) {
		assert.equal(mergeCalendar({ wordsPerDot: invalid }).wordsPerDot, 250);
	}
});

test("every Calendar control reads and writes its setting and refuses bad values", () => {
	const settings = defaultSettings();
	const keys = calendarGroups().flatMap((group) => (group.items ?? []).flatMap((item) => ("control" in item && item.control ? [item.control.key] : [])));
	assert.deepEqual(keys, [CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_WORDS_PER_DOT_KEY]);
	assert.equal(writeControl(settings, CALENDAR_SHOW_WEEK_NUMBERS_KEY, false), true);
	assert.equal(writeControl(settings, CALENDAR_SHOW_WEEK_NUMBERS_KEY, "no"), false);
	assert.equal(writeControl(settings, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, false), true);
	assert.equal(writeControl(settings, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, 0), false);
	assert.equal(writeControl(settings, CALENDAR_WORDS_PER_DOT_KEY, 0), true);
	assert.equal(readControl(settings, CALENDAR_WORDS_PER_DOT_KEY), 0);
	assert.equal(writeControl(settings, CALENDAR_WORDS_PER_DOT_KEY, 120), true);
	assert.equal(writeControl(settings, CALENDAR_WORDS_PER_DOT_KEY, -5), false);
	assert.equal(writeControl(settings, CALENDAR_WORDS_PER_DOT_KEY, 1.5), false);
	assert.equal(writeControl(settings, CALENDAR_WORDS_PER_DOT_KEY, "120"), false);
	assert.equal(writeControl(settings, "calendar/unknown", true), false);
	assert.deepEqual(settings.calendar, { showWeekNumbers: false, confirmBeforeCreate: false, wordsPerDot: 120 });
	assert.equal(readControl(settings, CALENDAR_SHOW_WEEK_NUMBERS_KEY), false);
	assert.equal(readControl(settings, CALENDAR_CONFIRM_BEFORE_CREATE_KEY), false);
	assert.deepEqual(mergeSettings(JSON.parse(JSON.stringify(settings))).calendar, settings.calendar);
});

test("the Date notes page warns about week numbers only while the week start disagrees with the week format", () => {
	let disagrees = true;
	const group = weekStartMismatchGroup(() => disagrees);
	const visible = () => (typeof group.visible === "function" ? group.visible() : group.visible);
	assert.equal(visible(), true);
	assert.deepEqual((group.items ?? []).map((item) => (item as { name: string }).name), ["Week numbers differ between the calendar and weekly notes"]);
	assert.match((group.items?.[0] as { desc: string }).desc, /Week starts on.*Neither setting is changed automatically/);
	disagrees = false;
	assert.equal(visible(), false);
});
