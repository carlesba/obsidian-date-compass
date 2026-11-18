import { test } from "node:test";
import { strict as assert } from "node:assert";
import { backlinkIndex, decoratorOf, defaultDecorators, dotCount, dotsOfDecorators, matchesFilters, mergeDecorators, validCells } from "../src/calendar/decorators.ts";
import type { DotDecorator, LinkingNote } from "../src/calendar/decorators.ts";
import { defaultSettings } from "../src/settings.ts";
import { decoratorKey, decoratorPageRefresh, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { decoratorName, decoratorSummary } from "../src/settings/calendarPage.ts";

const words = (amountPerDot = 250): DotDecorator => ({ ...decoratorOf("words", "dots-1"), amountPerDot });
const tasks = decoratorOf("openTasks", "dots-2");
const links = decoratorOf("links", "dots-3");

test("the default dots keep the earlier calendar: word dots below, then a hollow task dot", () => {
	const [wordDots, taskDots] = defaultDecorators();
	assert.deepEqual([wordDots.source, wordDots.count, wordDots.amountPerDot, wordDots.maxDots, wordDots.shape], ["words", "perAmount", 250, 5, "filled"]);
	assert.deepEqual([taskDots.source, taskDots.count, taskDots.shape], ["openTasks", "presence", "hollow"]);
	const amounts = { words: 749, openTasks: 1, links: 0 };
	assert.deepEqual(
		dotsOfDecorators(defaultDecorators(), "day", true, (decorator) => amounts[decorator.source]).map((dot) => dot.shape),
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
	assert.deepEqual(dotsOfDecorators([words(), tasks, { ...links, showWithoutNote: false }], "day", false, amountOf), []);
	assert.deepEqual(dotsOfDecorators([words(), tasks, links, { ...tasks, showWithoutNote: true }], "day", false, amountOf).map((dot) => dot.decoratorId), ["dots-3"]);
});

test("dots show only on the cells they are set for", () => {
	const daysOnly = { ...tasks, cells: ["day" as const] };
	const weeksOnly = { ...links, cells: ["week" as const] };
	assert.deepEqual(dotsOfDecorators([daysOnly, weeksOnly], "day", true, () => 1).map((dot) => dot.decoratorId), ["dots-2"]);
	assert.deepEqual(dotsOfDecorators([daysOnly, weeksOnly], "week", true, () => 1).map((dot) => dot.decoratorId), ["dots-3"]);
	assert.deepEqual(validCells(["week", "day"]), ["day", "week"]);
	for (const invalid of [[], ["day", "day"], ["month"], "day", undefined]) assert.equal(validCells(invalid), undefined);
});

test("stored dots merge field by field and drop what the plugin does not know", () => {
	const [merged] = mergeDecorators([{ id: "mine", source: "links", color: "red", position: "topRight", maxDots: 9, amountPerDot: 0, cells: ["week"], filters: [{ kind: "tag", value: "#meeting" }] }], undefined);
	assert.equal(merged.id, "mine");
	assert.deepEqual([merged.color, merged.position, merged.maxDots, merged.amountPerDot, merged.showWithoutNote], ["red", "topRight", 1, 1, true]);
	assert.deepEqual(merged.cells, ["week"]);
	assert.deepEqual(merged.filters, [{ kind: "tag", value: "#meeting" }]);
	const [fallback] = mergeDecorators([{ source: "colors", shape: "square", filters: [{ kind: "regex", value: "x" }] }], undefined);
	assert.deepEqual([fallback.source, fallback.shape, fallback.filters, fallback.cells], ["words", "filled", [], ["day", "week"]]);
	assert.deepEqual(mergeDecorators(undefined, 0).map((decorator) => decorator.source), ["openTasks"]);
});

test("a linking note passes when it matches every filter", () => {
	const note: LinkingNote = { path: "Meetings/Team sync.md", tags: ["#work/meeting"], frontmatter: { type: "meeting", people: ["Ana", "Luis"], empty: "" } };
	assert.equal(matchesFilters(note, []), true);
	assert.equal(matchesFilters(note, [{ kind: "pathStartsWith", value: "meetings/" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "pathStartsWith", value: "Projects/" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "nameStartsWith", value: "team" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "nameStartsWith", value: "Meetings" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "tag", value: "work" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "tag", value: "#work/meeting" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "tag", value: "wor" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "property", value: "type" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "property", value: "empty" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "property", value: "type: Meeting" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "property", value: "people: luis" }]), true);
	assert.equal(matchesFilters(note, [{ kind: "property", value: "type: call" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "tag", value: "work" }, { kind: "property", value: "type: call" }]), false);
	assert.equal(matchesFilters(note, [{ kind: "tag", value: " " }]), true);
	assert.equal(matchesFilters({ path: "a.md", tags: [], frontmatter: undefined }, [{ kind: "property", value: "type" }]), false);
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
	assert.equal(writeControl(settings, key("filters"), [{ kind: "tag", value: "x" }]), true);
	assert.equal(writeControl(settings, key("filters"), [{ kind: "tag" }]), false);
	assert.equal(readControl(settings, key("color")), "green");
	assert.deepEqual(readControl(settings, key("cells")), ["day"]);
	assert.equal(writeControl(settings, key("name"), "Long days"), true);
	assert.equal(writeControl(settings, key("source"), "links"), true);
	const changed = settings.calendar.decorators[0];
	assert.deepEqual([changed.id, changed.name, changed.source, changed.color, changed.amountPerDot, changed.cells], [first.id, "Long days", "links", "accent", 1, ["day"]]);
	assert.equal(writeControl(settings, decoratorKey("missing", "color"), "red"), false);
	assert.equal(decoratorPageRefresh(key("source")), "now");
	assert.equal(decoratorPageRefresh(key("name")), "afterTyping");
	assert.equal(decoratorPageRefresh(key("filters")), "none");
	assert.equal(decoratorPageRefresh("commands/x/name"), undefined);
});

test("a dots row is named after its source until it has a name, and its summary says how it looks", () => {
	assert.equal(decoratorName(words()), "Words");
	assert.equal(decoratorName({ ...links, name: " Meetings " }), "Meetings");
	assert.equal(decoratorSummary(words()), "One dot per 250 words, up to 5 · filled, theme default, below the number");
	assert.equal(
		decoratorSummary({ ...links, name: "Meetings", color: "red", position: "topRight", cells: ["day"], filters: [{ kind: "tag", value: "meeting" }] }),
		"Linking notes · one dot · filled, red, top-right corner · matching notes only · days only · also without a note",
	);
});
