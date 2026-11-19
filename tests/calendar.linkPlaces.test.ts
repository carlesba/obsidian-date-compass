import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { SettingDefinitionList } from "obsidian";
import { decoratorOf, duplicateDecorator, linkPlacesToAdd, linkReachesTarget, linkedFromPlaces, mergeDecorators, propertyOfFrontmatterKey } from "../src/calendar/decorators.ts";
import type { DotDecorator, LinkLocation, LinkPlace } from "../src/calendar/decorators.ts";
import { defaultSettings } from "../src/settings.ts";
import { decoratorKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { calendarItems, decoratorSummary } from "../src/settings/calendarPage.ts";
import type { CalendarPageContext, Choice } from "../src/settings/calendarPage.ts";

const links = decoratorOf("links", "dots-1");
const body: LinkPlace = { kind: "body" };
const anyProperty: LinkPlace = { kind: "anyProperty" };
const due: LinkPlace = { kind: "property", name: "due" };
const FROM_BODY: LinkLocation = {};
const FROM_DUE: LinkLocation = { property: "due" };
const FROM_DATES: LinkLocation = { property: "dates" };

test("with no place listed a link anywhere counts, and with places only a link from one of them counts", () => {
	assert.equal(linkedFromPlaces([], [FROM_BODY]), true);
	assert.equal(linkedFromPlaces([], [FROM_DUE]), true);
	assert.equal(linkedFromPlaces([], []), false);
	assert.equal(linkedFromPlaces([body], [FROM_BODY]), true);
	assert.equal(linkedFromPlaces([body], [FROM_DUE]), false);
	assert.equal(linkedFromPlaces([anyProperty], [FROM_DATES]), true);
	assert.equal(linkedFromPlaces([anyProperty], [FROM_BODY]), false);
	assert.equal(linkedFromPlaces([due], [FROM_DATES]), false);
	assert.equal(linkedFromPlaces([due], [FROM_BODY, { property: "Due" }]), true);
	assert.equal(linkedFromPlaces([due, { kind: "property", name: "dates" }], [FROM_DATES]), true);
});

test("a link in a list property is read as a link from that property", () => {
	assert.equal(propertyOfFrontmatterKey("due"), "due");
	assert.equal(propertyOfFrontmatterKey("reminders.2"), "reminders");
});

test("a link reaches the date note when it resolves to it, or by path or name before the note exists", () => {
	assert.equal(linkReachesTarget("Daily/2026-11-25.md", "2026-11-25", "Daily/2026-11-25.md"), true);
	assert.equal(linkReachesTarget("Daily/2026-11-25.md", "2026-11-25", "Archive/2026-11-25.md"), false);
	assert.equal(linkReachesTarget("Daily/2026-11-26.md", "2026-11-26", undefined), true);
	assert.equal(linkReachesTarget("Daily/2026-11-26.md", "daily/2026-11-26.md", undefined), true);
	assert.equal(linkReachesTarget("Daily/2026-11-26.md", "2026-11-27", undefined), false);
});

test("stored places merge for linking-note dots only, and a bad list falls back to anywhere", () => {
	const [merged] = mergeDecorators([{ id: "a", source: "links", linkPlaces: [{ kind: "property", name: " due " }, { kind: "body" }] }], undefined);
	assert.deepEqual(merged.linkPlaces, [due, body]);
	for (const invalid of ["body", [{ kind: "head" }], [{ kind: "property", name: " " }], [body, body], [due, { kind: "property", name: "DUE" }]]) {
		assert.deepEqual(mergeDecorators([{ id: "a", source: "links", linkPlaces: invalid }], undefined)[0].linkPlaces, [], JSON.stringify(invalid));
	}
	assert.deepEqual(mergeDecorators([{ id: "a", source: "links" }], undefined)[0].linkPlaces, []);
	assert.deepEqual(mergeDecorators([{ id: "a", source: "words", linkPlaces: [body] }], undefined)[0].linkPlaces, []);
});

test("the places control writes a valid list on linking-note dots and refuses anything else", () => {
	const settings = defaultSettings();
	settings.calendar.decorators.push({ ...links, id: "dots-links" });
	const key = decoratorKey("dots-links", "linkPlaces");
	assert.equal(writeControl(settings, key, [body, due]), true);
	assert.deepEqual(readControl(settings, key), [body, due]);
	assert.equal(writeControl(settings, key, [body, body]), false);
	assert.equal(writeControl(settings, key, []), true);
	assert.equal(writeControl(settings, decoratorKey(settings.calendar.decorators[0].id, "linkPlaces"), [body]), false);
	assert.equal(writeControl(settings, decoratorKey("dots-links", "source"), "words"), true);
	assert.equal(writeControl(settings, decoratorKey("dots-links", "source"), "links"), true);
	assert.deepEqual(readControl(settings, key), []);
});

test("the add picker offers the body, any property and each vault property once, leaving out what is listed", () => {
	assert.deepEqual(linkPlacesToAdd([], ["due", "Due", " "]), [body, anyProperty, due]);
	assert.deepEqual(linkPlacesToAdd([body, { kind: "property", name: "DUE" }], ["due", "dates"]), [anyProperty, { kind: "property", name: "dates" }]);
});

test("the summary says where the link has to be", () => {
	assert.equal(decoratorSummary({ ...links, linkPlaces: [body, due] }), "One dot · filled, accent, below the number · linked from the body, due · also without a note");
	assert.equal(decoratorSummary({ ...links, linkPlaces: [anyProperty] }), "One dot · filled, accent, below the number · linked from any property · also without a note");
});

test("a duplicate copies every option under a free id and its own name, without sharing lists with the original", () => {
	const original: DotDecorator = { ...links, id: "dots-1", color: "red", linkPlaces: [due] };
	const copy = duplicateDecorator([original, { ...links, id: "dots-2" }], original, "Linking notes copy");
	assert.deepEqual(copy, { ...original, id: "dots-3", name: "Linking notes copy" });
	copy.linkPlaces.push(body);
	assert.deepEqual(original.linkPlaces, [due]);
});

function placesListOf(decorator: DotDecorator, context: CalendarPageContext): SettingDefinitionList {
	const page = calendarItems([decorator], context).flatMap((item) => ("items" in item && item.type === "group" && item.visible === false ? item.items : []))[0];
	const list = (page as { items: unknown[] }).items.find((item) => (item as SettingDefinitionList).heading === "Link found in");
	assert.ok(list);
	return list as SettingDefinitionList;
}

test("the place list says anywhere while empty, and + searches the places and accepts a typed property", () => {
	const writes: unknown[] = [];
	let offered: Choice<string>[] = [];
	let typed: (query: string) => Choice<string> | undefined = () => undefined;
	let pick: (value: string) => void = () => undefined;
	const context: CalendarPageContext = {
		decorators: () => [],
		sharesRootIdWithOriginalCalendar: () => false,
		openPage: () => undefined,
		change: async () => undefined,
		write: (_key, value) => void writes.push(value),
		notify: () => undefined,
		choose: () => undefined,
		search: (_anchor, choices, typedChoice, picked) => {
			offered = choices;
			typed = typedChoice;
			pick = picked;
		},
		propertyNames: () => ["dates", "due"],
		propertyTypes: () => ({}),
		renderFilter: () => () => undefined,
	};
	const empty = placesListOf(links, context);
	assert.equal(empty.emptyState, "Anywhere");
	assert.deepEqual(empty.items, []);
	const listed = placesListOf({ ...links, linkPlaces: [due] }, context);
	assert.deepEqual(listed.items?.map((item) => (item as { name: string }).name), ["Property: due"]);
	listed.addItem?.action({} as HTMLElement);
	assert.deepEqual(offered.map((choice) => choice.name), ["Note body", "Any property", "Property: dates"]);
	assert.equal(typed("Due"), undefined);
	assert.equal(typed("dates"), undefined);
	assert.equal(typed("reminders")?.name, "Property: reminders");
	pick(typed("reminders")?.value ?? "");
	pick(offered[0].value);
	assert.deepEqual(writes, [
		[due, { kind: "property", name: "reminders" }],
		[due, body],
	]);
	listed.onDelete?.(0);
	assert.deepEqual(writes.at(-1), []);
});
