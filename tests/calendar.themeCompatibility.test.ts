import { test } from "node:test";
import { strict as assert } from "node:assert";
import { defaultCalendar } from "../src/calendar/settings.ts";
import { rootIdOf, sharesRootIdWithOriginalCalendar } from "../src/calendar/themeCompatibility.ts";

const compatible = { ...defaultCalendar(), themeCompatibility: true };

test("the calendar root carries the original Calendar id only while theme compatibility is on", () => {
	assert.equal(rootIdOf(defaultCalendar()), undefined);
	assert.equal(rootIdOf(compatible), "calendar-container");
});

test("the root id is shared only when theme compatibility is on and the original Calendar plugin is enabled", () => {
	assert.equal(sharesRootIdWithOriginalCalendar(compatible, new Set(["calendar", "dataview"])), true);
	assert.equal(sharesRootIdWithOriginalCalendar(compatible, new Set(["dataview", "calendar-beta"])), false);
	assert.equal(sharesRootIdWithOriginalCalendar(compatible, new Set()), false);
	assert.equal(sharesRootIdWithOriginalCalendar(defaultCalendar(), new Set(["calendar"])), false);
});
