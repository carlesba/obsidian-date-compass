import { test } from "node:test";
import { strict as assert } from "node:assert";
import { monthAfterDayChange, sameDay, sameMonth, shiftMonth } from "../src/calendar/navigation.ts";

test("the arrows move one month and cross year boundaries", () => {
	assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2026, month: 12 });
	assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
	assert.deepEqual(shiftMonth({ year: 2027, month: 1 }, -1), { year: 2026, month: 12 });
});

test("at midnight a calendar showing the current month rolls over to the new month", () => {
	const lastOfNovember = { year: 2026, month: 11, day: 30 };
	const firstOfDecember = { year: 2026, month: 12, day: 1 };
	assert.deepEqual(monthAfterDayChange({ year: 2026, month: 11 }, lastOfNovember, firstOfDecember), { year: 2026, month: 12 });
	assert.deepEqual(monthAfterDayChange({ year: 2026, month: 12 }, { year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 }), { year: 2027, month: 1 });
});

test("a day change inside the month, or while another month is displayed, keeps the displayed month", () => {
	assert.deepEqual(monthAfterDayChange({ year: 2026, month: 11 }, { year: 2026, month: 11, day: 17 }, { year: 2026, month: 11, day: 18 }), { year: 2026, month: 11 });
	assert.deepEqual(monthAfterDayChange({ year: 2026, month: 3 }, { year: 2026, month: 11, day: 30 }, { year: 2026, month: 12, day: 1 }), { year: 2026, month: 3 });
	assert.deepEqual(monthAfterDayChange({ year: 2026, month: 12 }, { year: 2026, month: 11, day: 30 }, { year: 2026, month: 12, day: 1 }), { year: 2026, month: 12 });
});

test("days and months compare by value", () => {
	assert.equal(sameDay({ year: 2026, month: 11, day: 17 }, { year: 2026, month: 11, day: 17 }), true);
	assert.equal(sameDay({ year: 2026, month: 11, day: 17 }, { year: 2026, month: 11, day: 18 }), false);
	assert.equal(sameMonth({ year: 2026, month: 11 }, { year: 2026, month: 11 }), true);
	assert.equal(sameMonth({ year: 2026, month: 11 }, { year: 2025, month: 11 }), false);
});
