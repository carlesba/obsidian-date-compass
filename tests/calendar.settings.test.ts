import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultCalendar, mergeCalendar } from "../src/calendar/settings.ts";
import { defaultSettings, mergeSettings } from "../src/settings.ts";
import { defaultDecorators } from "../src/calendar/decorators.ts";
import { CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_THEME_COMPATIBILITY_KEY, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { calendarItems } from "../src/settings/calendarPage.ts";
import type { SettingDefinitionGroup } from "obsidian";
import type { CalendarPageContext } from "../src/settings/calendarPage.ts";
import { weekStartMismatchGroup } from "../src/settings/dateNotesPage.ts";

const DEFAULTS = { showWeekNumbers: true, confirmBeforeCreate: true, decorators: defaultDecorators(), themeCompatibility: false };

function contextOf(shared: () => boolean = () => false): CalendarPageContext {
	return { decorators: () => [], sharesRootIdWithOriginalCalendar: shared, openPage: () => undefined, change: async () => undefined, write: () => undefined, notify: () => undefined, choose: () => undefined };
}

function groupsOf(shared?: () => boolean): SettingDefinitionGroup[] {
	return calendarItems([], contextOf(shared)).filter((item): item is SettingDefinitionGroup => "type" in item && item.type === "group");
}

test("the calendar shows week numbers, confirms before creating, shows word and task dots and leaves theme compatibility off by default", () => {
	assert.deepEqual(defaultCalendar(), DEFAULTS);
	assert.deepEqual(mergeCalendar(undefined), DEFAULTS);
	assert.deepEqual(mergeCalendar("broken"), DEFAULTS);
	assert.deepEqual(mergeCalendar([true, false, 3]), DEFAULTS);
});

test("stored calendar settings merge over the defaults field by field", () => {
	assert.deepEqual(mergeCalendar({ showWeekNumbers: false }), { ...DEFAULTS, showWeekNumbers: false });
	assert.deepEqual(mergeCalendar({ confirmBeforeCreate: false }), { ...DEFAULTS, confirmBeforeCreate: false });
	assert.deepEqual(mergeCalendar({ themeCompatibility: true }), { ...DEFAULTS, themeCompatibility: true });
	assert.deepEqual(mergeCalendar({ themeCompatibility: "yes" }), DEFAULTS);
	assert.deepEqual(mergeCalendar({ showWeekNumbers: "no", confirmBeforeCreate: 0 }), DEFAULTS);
	assert.deepEqual(mergeSettings({ calendar: { wordsPerDot: 40 } }).calendar, { ...DEFAULTS, decorators: defaultDecorators(40) });
});

test("a stored words per dot becomes the amount of the word dots, and 0 leaves only the task dots", () => {
	assert.equal(mergeCalendar({ wordsPerDot: 100 }).decorators[0].amountPerDot, 100);
	assert.deepEqual(mergeCalendar({ wordsPerDot: 0 }).decorators.map((decorator) => decorator.source), ["openTasks"]);
	for (const invalid of [-1, 2.5, Number.NaN, "100", null]) {
		assert.deepEqual(mergeCalendar({ wordsPerDot: invalid }).decorators, defaultDecorators());
	}
	assert.deepEqual(mergeCalendar({ wordsPerDot: 100, decorators: [] }).decorators, []);
});

test("every Calendar control reads and writes its setting and refuses bad values", () => {
	const settings = defaultSettings();
	const keys = groupsOf().flatMap((group) => (group.items ?? []).flatMap((item) => ("control" in item && item.control ? [item.control.key] : [])));
	assert.deepEqual(keys, [CALENDAR_SHOW_WEEK_NUMBERS_KEY, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, CALENDAR_THEME_COMPATIBILITY_KEY]);
	assert.equal(writeControl(settings, CALENDAR_SHOW_WEEK_NUMBERS_KEY, false), true);
	assert.equal(writeControl(settings, CALENDAR_SHOW_WEEK_NUMBERS_KEY, "no"), false);
	assert.equal(writeControl(settings, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, false), true);
	assert.equal(writeControl(settings, CALENDAR_CONFIRM_BEFORE_CREATE_KEY, 0), false);
	assert.equal(readControl(settings, CALENDAR_THEME_COMPATIBILITY_KEY), false);
	assert.equal(writeControl(settings, CALENDAR_THEME_COMPATIBILITY_KEY, true), true);
	assert.equal(writeControl(settings, CALENDAR_THEME_COMPATIBILITY_KEY, "yes"), false);
	assert.equal(readControl(settings, CALENDAR_THEME_COMPATIBILITY_KEY), true);
	assert.equal(writeControl(settings, "calendar/unknown", true), false);
	assert.deepEqual(settings.calendar, { showWeekNumbers: false, confirmBeforeCreate: false, decorators: defaultDecorators(), themeCompatibility: true });
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

test("the Calendar page warns about the shared id only while it is shared with the original Calendar plugin", () => {
	let shared = true;
	const warning = groupsOf(() => shared).find((group) => typeof group.visible === "function");
	const visible = () => (typeof warning?.visible === "function" ? warning.visible() : warning?.visible);
	assert.equal(visible(), true);
	assert.deepEqual((warning?.items ?? []).map((item) => (item as { name: string }).name), ["The Calendar plugin is enabled"]);
	assert.match((warning?.items?.[0] as { desc: string }).desc, /calendar-container.*disable the Calendar plugin/);
	shared = false;
	assert.equal(visible(), false);
});
