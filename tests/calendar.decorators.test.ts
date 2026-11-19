import { test } from "node:test";
import { strict as assert } from "node:assert";
import { backlinkIndex, decoratorOf, defaultDecorators, dotCount, canRemoveTime, dotsOfDecorators, mergeDecorators, previewDots, shows, timesToAdd, validCells, validTimes } from "../src/calendar/decorators.ts";
import type { DotDecorator, DotPlace } from "../src/calendar/decorators.ts";
import { defaultSettings } from "../src/settings.ts";
import { decoratorKey, decoratorPageRefresh, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { decoratorDescription, decoratorName } from "../src/settings/calendarPage.ts";

const words = (amountPerDot = 250): DotDecorator => ({ ...decoratorOf("words", "dots-1"), amountPerDot });
const tasks = decoratorOf("openTasks", "dots-2");
const links = decoratorOf("links", "dots-3");
const TODAY: DotPlace = { cell: "day", time: "current" };
const THIS_WEEK: DotPlace = { cell: "week", time: "current" };

test("the default dots keep the earlier calendar: word dots below, then a hollow task dot", () => {
	const [wordDots, taskDots] = defaultDecorators();
	assert.deepEqual([wordDots.source, wordDots.count, wordDots.amountPerDot, wordDots.maxDots, wordDots.shape], ["words", "perAmount", 250, 5, "filled"]);
	assert.deepEqual([taskDots.source, taskDots.count, taskDots.shape], ["openTasks", "presence", "hollow"]);
	const amounts = { words: 749, openTasks: 1, links: 0 };
	assert.deepEqual(
		dotsOfDecorators(defaultDecorators(), TODAY, true, (decorator) => amounts[decorator.source]).map((dot) => dot.shape),
		["filled", "filled", "hollow"],
	);
});

test("word dots show one per full batch of words, at least one and at most the limit", () => {
	assert.equal(dotCount(words(), 0), 1);
	assert.equal(dotCount(words(), 499), 1);
	assert.equal(dotCount(words(), 749), 2);
	assert.equal(dotCount(words(), 90_000), 5);
	assert.equal(dotCount({ ...words(10), maxDots: 3 }, 90), 3);
	assert.equal(dotCount({ ...words(), count: "presence" }, 0), 1);
});

test("task and link dots show only when there is something to count", () => {
	assert.equal(dotCount(tasks, 0), 0);
	assert.equal(dotCount(tasks, 3), 1);
	const perNote = { ...links, count: "perAmount" as const, amountPerDot: 2, maxDots: 4 };
	assert.equal(dotCount(perNote, 0), 0);
	assert.equal(dotCount(perNote, 1), 1);
	assert.equal(dotCount(perNote, 6), 3);
	assert.equal(dotCount(perNote, 60), 4);
});

test("only link dots can show on a day without a note, and only when asked to", () => {
	const amountOf = () => 3;
	assert.deepEqual(dotsOfDecorators([words(), tasks, { ...links, showWithoutNote: false }], TODAY, false, amountOf), []);
	assert.deepEqual(dotsOfDecorators([words(), tasks, links, { ...tasks, showWithoutNote: true }], TODAY, false, amountOf).map((dot) => dot.decoratorId), ["dots-3"]);
});

test("dots show only on the cells they are set for", () => {
	const daysOnly = { ...tasks, cells: ["day" as const] };
	const weeksOnly = { ...links, cells: ["week" as const] };
	assert.deepEqual(dotsOfDecorators([daysOnly, weeksOnly], TODAY, true, () => 1).map((dot) => dot.decoratorId), ["dots-2"]);
	assert.deepEqual(dotsOfDecorators([daysOnly, weeksOnly], THIS_WEEK, true, () => 1).map((dot) => dot.decoratorId), ["dots-3"]);
	assert.deepEqual(validCells(["week", "day"]), ["day", "week"]);
	assert.deepEqual(validCells(["year", "month", "quarter"]), ["month", "quarter", "year"]);
	for (const invalid of [[], ["day", "day"], ["decade"], "day", undefined]) assert.equal(validCells(invalid), undefined);
});

test("dots show only for the times they are set for", () => {
	const pastOnly = { ...tasks, times: ["past" as const] };
	const comingUp = { ...links, times: ["current" as const, "future" as const] };
	const shownFor = (place: DotPlace) => dotsOfDecorators([pastOnly, comingUp], place, true, () => 1).map((dot) => dot.decoratorId);
	assert.deepEqual(shownFor({ cell: "day", time: "past" }), ["dots-2"]);
	assert.deepEqual(shownFor({ cell: "day", time: "current" }), ["dots-3"]);
	assert.deepEqual(shownFor({ cell: "week", time: "future" }), ["dots-3"]);
	assert.deepEqual(shownFor({ cell: "week", time: "past" }), ["dots-2"]);
	assert.equal(shows(tasks, { cell: "day", time: "future" }, true), true);
	assert.equal(shows({ ...pastOnly, cells: ["week"] }, { cell: "day", time: "past" }, true), false);
	assert.equal(shows(comingUp, { cell: "day", time: "future" }, false), true);
	assert.equal(shows(comingUp, { cell: "day", time: "past" }, false), false);
});

test("the times list keeps the fixed order, offers what is missing and keeps at least one", () => {
	assert.deepEqual(validTimes(["future", "past"]), ["past", "future"]);
	for (const invalid of [[], ["past", "past"], ["today"], "past", undefined]) assert.equal(validTimes(invalid), undefined);
	assert.deepEqual(timesToAdd(["current"]), ["past", "future"]);
	assert.deepEqual(timesToAdd(["past", "current", "future"]), []);
	assert.equal(canRemoveTime(["past", "future"]), true);
	assert.equal(canRemoveTime(["future"]), false);
});

test("stored dots merge field by field and drop what the plugin does not know", () => {
	const [merged] = mergeDecorators([{ id: "mine", source: "links", color: "red", position: "topRight", maxDots: 9, amountPerDot: 0, cells: ["week"], times: ["future", "current"], filters: [{ kind: "tag", value: "#meeting" }] }], undefined);
	assert.equal(merged.id, "mine");
	assert.deepEqual([merged.color, merged.position, merged.maxDots, merged.amountPerDot, merged.showWithoutNote], ["red", "topRight", 1, 1, true]);
	assert.deepEqual(merged.cells, ["week"]);
	assert.deepEqual(merged.times, ["current", "future"]);
	assert.deepEqual([merged.filter, merged.legacyFilters], [{ kind: "group", mode: "all", items: [{ kind: "file", field: "file", condition: { operator: "has tag", value: "#meeting" } }] }, []]);
	const [fallback] = mergeDecorators([{ source: "colors", shape: "square", filters: [{ kind: "regex", value: "x" }] }], undefined);
	assert.deepEqual([fallback.source, fallback.shape, fallback.filter.items, fallback.legacyFilters, fallback.cells], ["words", "filled", [], [], ["day", "week", "month", "quarter", "year"]]);
	assert.deepEqual(fallback.times, ["past", "current", "future"]);
	const savedBeforeTimes = { id: "old", source: "openTasks", count: "presence", amountPerDot: 1, maxDots: 1, shape: "hollow", color: "default", position: "below", showWithoutNote: false, cells: ["day"], filters: [] };
	assert.deepEqual(mergeDecorators([savedBeforeTimes], undefined)[0].times, ["past", "current", "future"]);
	for (const invalid of [[], ["soon"], ["past", "past"], "future"]) assert.deepEqual(mergeDecorators([{ ...savedBeforeTimes, times: invalid }], undefined)[0].times, ["past", "current", "future"]);
	assert.deepEqual(mergeDecorators(undefined, 0).map((decorator) => decorator.source), ["openTasks"]);
});

test("a date note is linked from resolved links, and from unresolved links by path or name before it exists", () => {
	const index = backlinkIndex({
		resolved: { "Meetings/a.md": { "Daily/2026-11-25.md": 2 }, "Daily/2026-11-25.md": { "Daily/2026-11-25.md": 1 }, "Meetings/b.md": { "Other.md": 1 } },
		unresolved: { "Meetings/c.md": { "2026-11-26": 1 }, "Meetings/d.md": { "Daily/2026-11-26": 1 }, "Meetings/e.md": { "2026-11-27": 1 } },
	});
	assert.deepEqual(index.sourcesOf("Daily/2026-11-25.md"), ["Meetings/a.md"]);
	assert.deepEqual(index.sourcesOf("Daily/2026-11-26.md").sort(), ["Meetings/c.md", "Meetings/d.md"]);
	assert.deepEqual(index.sourcesOf("Daily/2026-11-28.md"), []);
});

test("every dots field reads and writes through its control key and refuses bad values", () => {
	const settings = defaultSettings();
	const [first] = settings.calendar.decorators;
	const key = (field: Parameters<typeof decoratorKey>[1]) => decoratorKey(first.id, field);
	assert.equal(writeControl(settings, key("color"), "green"), true);
	assert.equal(writeControl(settings, key("color"), "teal"), false);
	assert.equal(writeControl(settings, key("position"), "above"), true);
	assert.equal(writeControl(settings, key("amountPerDot"), 100), true);
	assert.equal(writeControl(settings, key("amountPerDot"), 0), false);
	assert.equal(writeControl(settings, key("maxDots"), 6), false);
	assert.equal(writeControl(settings, key("cells"), ["day"]), true);
	assert.equal(writeControl(settings, key("cells"), []), false);
	assert.equal(writeControl(settings, key("times"), ["future", "current"]), true);
	assert.equal(writeControl(settings, key("times"), []), false);
	assert.equal(writeControl(settings, key("times"), ["soon"]), false);
	assert.equal(readControl(settings, key("color")), "green");
	assert.deepEqual(readControl(settings, key("cells")), ["day"]);
	assert.deepEqual(readControl(settings, key("times")), ["current", "future"]);
	assert.equal(writeControl(settings, key("name"), "Long days"), true);
	assert.equal(writeControl(settings, key("source"), "links"), true);
	const changed = settings.calendar.decorators[0];
	assert.deepEqual([changed.id, changed.name, changed.source, changed.color, changed.amountPerDot, changed.cells, changed.times], [first.id, "Long days", "links", "accent", 1, ["day"], ["current", "future"]]);
	assert.equal(writeControl(settings, decoratorKey("missing", "color"), "red"), false);
	assert.equal(decoratorPageRefresh(key("source")), "now");
	assert.equal(decoratorPageRefresh(key("times")), "now");
	assert.equal(decoratorPageRefresh(key("name")), "afterTyping");
	assert.equal(decoratorPageRefresh("commands/x/name"), undefined);
});

test("a dots row is named after its source until it has a name, and its description says what the dots count", () => {
	assert.equal(decoratorName(words()), "Words");
	assert.equal(decoratorName({ ...links, name: " Meetings " }), "Meetings");
	assert.equal(decoratorDescription(words()), "content");
	assert.equal(decoratorDescription(tasks), "tasks");
	assert.equal(decoratorDescription(links), "body or property");
});

test("a dots row previews one dot, or the most dots when it counts per amount, in its own look", () => {
	const preview = previewDots({ ...words(), maxDots: 3, color: "red", position: "topRight" });
	assert.deepEqual(preview.map((dot) => [dot.color, dot.position, dot.shape]), [["red", "topRight", "filled"], ["red", "topRight", "filled"], ["red", "topRight", "filled"]]);
	assert.equal(previewDots(tasks).length, 1);
});
