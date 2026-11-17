import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Command } from "obsidian";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { ParseOptions } from "../src/parse/index.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import { previewSequence } from "../src/sequence/preview.ts";
import type { SequenceContext } from "../src/sequence/preview.ts";
import { linkTarget } from "../src/insertion/property.ts";
import { actionName, actionWarning, mergeActions, newAction, presetActions, questionOf } from "../src/actions/settings.ts";
import { propertyKind, valueToWrite } from "../src/actions/value.ts";
import { propertyWidgetOf } from "../src/actions/propertyType.ts";
import { ActionCommands, actionCommands } from "../src/actions/commands.ts";
import { actionSummary, actionsPage } from "../src/settings/actionsPage.ts";
import { pagePath } from "../src/settings/pages.ts";
import { actionKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultSettings, mergeSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

const rowContext: SequenceContext = { now, moment, options, periods: defaultDateNotes().periods, allows: () => true };

function notesOf(phrase: string): NoteRef[] {
	const preview = previewSequence(phrase, rowContext);
	assert.equal(preview.kind, "dates", phrase);
	return preview.kind === "dates" ? preview.notes : [];
}

const linkTo = (note: NoteRef) => `[[${note.name}]]`;

const v1AddDates = {
	id: "add-dates",
	name: "Add dates",
	enabled: true,
	inputs: [
		{ id: "dates", key: "dates", question: "Dates", type: "dates", optional: false, defaultText: "" },
		{ id: "update-start-and-end", key: "updateStartAndEnd", question: "Update start and end?", type: "yesNo", optional: false, defaultText: "" },
	],
	writes: [
		{ id: "dates", target: "property", property: "dates", input: "dates", value: "links", format: "link", mode: "append", condition: "" },
		{ id: "start", target: "property", property: "start", input: "dates", value: "first", format: "dateText", mode: "replace", condition: "update-start-and-end" },
		{ id: "end", target: "property", property: "end", input: "dates", value: "last", format: "dateText", mode: "replace", condition: "update-start-and-end" },
	],
};

const v1SetReminders = {
	id: "set-reminders",
	name: "Set reminders",
	enabled: true,
	inputs: [{ id: "reminders", key: "reminders", question: "Reminders", type: "dates", optional: false, defaultText: "" }],
	writes: [{ id: "reminders", target: "property", property: "reminders", input: "reminders", value: "links", format: "link", mode: "append", condition: "" }],
};

test("presets are Set dates and Set reminders, both asking for dates as links", () => {
	assert.deepEqual(presetActions(), [
		{ id: "set-dates", name: "Set dates", enabled: true, property: "dates", asks: "dates", link: true },
		{ id: "set-reminders", name: "Set reminders", enabled: true, property: "reminders", asks: "dates", link: true },
	]);
	assert.deepEqual(mergeSettings({ weekStart: "monday" }).actions, presetActions());
});

test("the two stored v1 presets migrate to Set dates and Set reminders keeping their ids", () => {
	const migrated = mergeSettings({ actions: [v1AddDates, v1SetReminders] }).actions;
	assert.deepEqual(migrated, [
		{ id: "add-dates", name: "Set dates", enabled: true, property: "dates", asks: "dates", link: true },
		{ id: "set-reminders", name: "Set reminders", enabled: true, property: "reminders", asks: "dates", link: true },
	]);
});

test("a custom v1 action keeps its name, its disabled state, and takes its first property write", () => {
	const [action] = mergeActions([
		{
			id: "trip",
			name: "Plan trip",
			enabled: false,
			inputs: [{ id: "when", key: "when", question: "When?", type: "date", optional: true, defaultText: "today" }],
			writes: [{ id: "w", target: "property", property: " due ", input: "when", value: "first", format: "dateText", mode: "replace", condition: "" }],
		},
	]);
	assert.deepEqual(action, { id: "trip", name: "Plan trip", enabled: false, property: "due", asks: "date", link: false });
});

test("a v1 action with several writes uses the first property write, skipping body writes", () => {
	const [action] = mergeActions([
		{
			id: "mix",
			name: "Mix",
			inputs: [
				{ id: "one", type: "periodicNote" },
				{ id: "many", type: "dates" },
			],
			writes: [
				{ id: "a", target: "body", property: "", input: "many", format: "link" },
				{ id: "b", target: "property", property: "week", input: "one", format: "link" },
				{ id: "c", target: "property", property: "other", input: "many", format: "dateText" },
			],
		},
	]);
	assert.deepEqual(action, { id: "mix", name: "Mix", enabled: true, property: "week", asks: "date", link: true });
});

test("a v1 action with no property write is dropped, and one whose question is missing asks for dates", () => {
	const noWrites = { id: "empty", name: "Empty", inputs: [], writes: [] };
	const bodyOnly = { id: "body", name: "Body", inputs: [{ id: "d", type: "dates" }], writes: [{ id: "w", target: "body", input: "d" }] };
	const noProperty = { id: "blank", name: "Blank", inputs: [], writes: [{ id: "w", target: "property", property: "  ", input: "d" }] };
	const missingQuestion = { id: "lost", name: "Lost", inputs: [], writes: [{ id: "w", target: "property", property: "when", input: "gone", format: "link" }] };
	const yesNoQuestion = { id: "yn", name: "YN", inputs: [{ id: "q", type: "yesNo" }], writes: [{ id: "w", target: "property", property: "flag", input: "q", format: "dateText" }] };
	assert.deepEqual(mergeActions([noWrites, bodyOnly, noProperty, missingQuestion, yesNoQuestion]), [
		{ id: "lost", name: "Lost", enabled: true, property: "when", asks: "dates", link: true },
		{ id: "yn", name: "YN", enabled: true, property: "flag", asks: "dates", link: false },
	]);
});

test("no stored actions gives the presets, an empty list stays empty, unknown keys are dropped", () => {
	assert.deepEqual(mergeActions(undefined), presetActions());
	assert.deepEqual(mergeActions({ not: "a list" }), presetActions());
	assert.deepEqual(mergeActions([]), []);
	const [action] = mergeActions([{ id: "x", name: "X", enabled: true, property: "p", asks: "date", link: false, extra: 1, inputs: "junk" }, "broken", 3]);
	assert.deepEqual(action, { id: "x", name: "X", enabled: true, property: "p", asks: "date", link: false });
});

test("migrating twice changes nothing, and ids are kept unique", () => {
	const once = mergeActions([v1AddDates, v1SetReminders, { ...v1SetReminders, name: "Again" }, { id: "a/b", name: "Slash", asks: "dates", property: "p" }]);
	assert.deepEqual(mergeActions(JSON.parse(JSON.stringify(once))), once);
	assert.deepEqual(once.map((action) => action.id), ["add-dates", "set-reminders", "action-1", "action-2"]);
});

test("stored v2 fields fall back field by field", () => {
	const [action] = mergeActions([{ id: "p", asks: "dates", name: 3, enabled: "yes", property: null, link: "no" }]);
	assert.deepEqual(action, { id: "p", name: "", enabled: true, property: "", asks: "dates", link: true });
});

const kinds = ["date", "datetime", "other", "list"] as const;

test("property kinds come from the registry widget, unknown widgets are plain", () => {
	assert.deepEqual([undefined, "date", "datetime", "text", "number", "multitext", "tags", "aliases"].map(propertyKind), ["other", "date", "datetime", "other", "other", "list", "list", "list"]);
});

test("a range writes every date, as links or as the format of the property type", () => {
	const notes = notesOf("nov 18 to nov 21");
	const write = (kind: (typeof kinds)[number], link: boolean) => valueToWrite({ notes, link, kind, existingIsList: false, linkTo });
	assert.deepEqual(write("date", true), ["[[2026-11-18]]", "[[2026-11-19]]", "[[2026-11-20]]", "[[2026-11-21]]"]);
	assert.deepEqual(write("date", false), ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
	assert.deepEqual(write("datetime", false)[0], "2026-11-18T00:00");
	assert.deepEqual(write("other", false), ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
	assert.equal(write("list", false).length, 4);
});

test("one date writes one value unless the property is a list or already holds a list", () => {
	const notes = notesOf("nov 18");
	const write = (kind: (typeof kinds)[number], link: boolean, existingIsList = false) => valueToWrite({ notes, link, kind, existingIsList, linkTo });
	assert.equal(write("date", true), "[[2026-11-18]]");
	assert.equal(write("date", false), "2026-11-18");
	assert.equal(write("datetime", false), "2026-11-18T00:00");
	assert.equal(write("other", false), "2026-11-18");
	assert.deepEqual(write("list", false), ["2026-11-18"]);
	assert.deepEqual(write("list", true), ["[[2026-11-18]]"]);
	assert.deepEqual(write("other", true, true), ["[[2026-11-18]]"]);
});

test("a week note without links is written as its note name for text and by its date for date properties", () => {
	const notes = notesOf("next week");
	assert.equal(notes.length, 1);
	assert.equal(valueToWrite({ notes, link: false, kind: "other", existingIsList: false, linkTo }), notes[0].name);
	assert.equal(valueToWrite({ notes, link: false, kind: "date", existingIsList: false, linkTo }), notes[0].date.format("YYYY-MM-DD"));
});

test("the property type lookup falls back to nothing when the registry is missing, empty or throws", () => {
	const app = (registry: unknown) => ({ metadataTypeManager: registry }) as never;
	assert.equal(propertyWidgetOf({} as never, "due"), undefined);
	assert.equal(propertyWidgetOf(app({ getAssignedWidget: () => "datetime" }), "due"), "datetime");
	assert.equal(propertyWidgetOf(app({ getAssignedWidget: () => undefined, properties: { due: { widget: "date" } } }), "Due"), "date");
	assert.equal(propertyWidgetOf(app({ properties: { due: { type: "multitext" } } }), "due"), "multitext");
	assert.equal(propertyWidgetOf(app({ properties: {} }), "due"), undefined);
	assert.equal(propertyWidgetOf(app({ getAssignedWidget: () => { throw new Error("gone"); } }), "due"), undefined);
});

test("the question an action asks names its property and what it takes", () => {
	assert.equal(questionOf({ ...presetActions()[0], property: " dates " }), "Which dates for dates?");
	assert.equal(questionOf({ ...presetActions()[0], asks: "date", property: "due" }), "Which date for due?");
});

test("an action without a property is flagged", () => {
	assert.equal(actionWarning(newAction([])), "Enter the property this action sets.");
	assert.equal(actionWarning(presetActions()[0]), undefined);
});

test("link targets read wikilinks, aliases, headings and markdown links", () => {
	assert.equal(linkTarget("[Wed](<2026 11 18.md>)"), "2026 11 18.md");
	assert.equal(linkTarget("[[2026-11-18#Tasks|Wed]]"), "2026-11-18");
});

function fakeCommandHost(): { commands: Map<string, string>; host: { addCommand(command: Command): void; removeCommand(id: string): void } } {
	const commands = new Map<string, string>();
	return {
		commands,
		host: {
			addCommand: (command) => void commands.set(command.id, command.name),
			removeCommand: (id) => void commands.delete(id),
		},
	};
}

test("one command per enabled action, re-registered when actions are enabled, disabled, renamed or removed", () => {
	const actions = presetActions();
	const { commands, host } = fakeCommandHost();
	const registry = new ActionCommands(host, ({ id, name }) => ({ id, name }));
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-set-dates", "Set dates"], ["action-set-reminders", "Set reminders"]]);
	actions[1].enabled = false;
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-set-dates", "Set dates"]]);
	actions[1].enabled = true;
	actions[0].name = "Plan trip";
	registry.sync(actions);
	assert.deepEqual([...commands].sort(), [["action-set-dates", "Plan trip"], ["action-set-reminders", "Set reminders"]]);
	actions.splice(0, 1);
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-set-reminders", "Set reminders"]]);
	assert.deepEqual(actionCommands([{ ...newAction([]), name: "  ", property: "p" }]).map((command) => command.name), ["Untitled action"]);
	assert.equal(actionName({ ...newAction([]), name: " Go " }), "Go");
});

test("the action controls read and write every field of an action and refuse bad values", () => {
	const settings = defaultSettings();
	const key = (field: Parameters<typeof actionKey>[1]) => actionKey("set-dates", field);
	assert.equal(readControl(settings, key("property")), "dates");
	assert.equal(writeControl(settings, key("property"), "when"), true);
	assert.equal(writeControl(settings, key("name"), "Mine"), true);
	assert.equal(writeControl(settings, key("enabled"), false), true);
	assert.equal(writeControl(settings, key("link"), false), true);
	assert.equal(writeControl(settings, key("asks"), "date"), true);
	assert.deepEqual(settings.actions[0], { id: "set-dates", name: "Mine", enabled: false, property: "when", asks: "date", link: false });
	assert.equal(writeControl(settings, key("asks"), "periodicNote"), false);
	assert.equal(writeControl(settings, key("link"), "no"), false);
	assert.equal(writeControl(settings, key("name"), 3), false);
	assert.equal(writeControl(settings, actionKey("missing", "name"), "x"), false);
	assert.equal(writeControl(settings, "actions/set-dates/inputs/x/key", "x"), false);
});

function controlKeysOf(items: readonly unknown[]): string[] {
	return items.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const record = item as { control?: { key: string }; items?: unknown[] };
		return [...(record.control ? [record.control.key] : []), ...controlKeysOf(record.items ?? [])];
	});
}

test("each action has one page with all its fields and nothing nests below it", () => {
	const settings = defaultSettings();
	const context = { actions: () => settings.actions, write: () => undefined, openPage: () => undefined, change: () => Promise.resolve() };
	const page = actionsPage(context);
	const [, hidden] = (page.items ?? []) as unknown as [unknown, { items: { id: string; items: unknown[] }[] }];
	assert.equal(hidden.items.length, 2);
	assert.deepEqual(controlKeysOf(hidden.items[0].items), ["name", "enabled", "property", "asks", "link"].sort((a, b) => ["enabled", "name", "property", "asks", "link"].indexOf(a) - ["enabled", "name", "property", "asks", "link"].indexOf(b)).map((field) => `actions/set-dates/${field}`));
	assert.equal(pagePath([{ type: "group", items: [page] }], "action-set-reminders")?.join("/"), "actions/action-set-reminders");
	assert.equal(pagePath([page], "nowhere"), undefined);
});

test("the Actions page adds, reorders and removes actions", async () => {
	const settings = defaultSettings();
	const opened: string[] = [];
	const context = { actions: () => settings.actions, write: () => undefined, openPage: (id: string) => void opened.push(id), change: (mutate: () => unknown) => Promise.resolve(void mutate()) };
	type ListLike = { onReorder?: (a: number, b: number) => void; onDelete?: (index: number) => void; addItem?: { action: (el: HTMLElement) => void } };
	const [actionsList] = (actionsPage(context).items ?? []) as unknown as [ListLike];
	actionsList.onReorder?.(0, 1);
	assert.deepEqual(settings.actions.map((action) => action.id), ["set-reminders", "set-dates"]);
	actionsList.addItem?.action({} as HTMLElement);
	await Promise.resolve();
	assert.match(opened[0], /^action-action-[a-z0-9]+-1$/);
	actionsList.onDelete?.(2);
	assert.deepEqual(settings.actions.map((action) => action.id), ["set-reminders", "set-dates"]);
});

test("a new action never reuses the id, and so the command, of a removed one", () => {
	const actions = presetActions();
	const first = newAction(actions, 1);
	actions.push(first);
	actions.splice(actions.indexOf(first), 1);
	assert.equal(newAction(actions, 1).id, first.id);
	assert.notEqual(newAction([first], 1).id, first.id);
});

test("the action row says what it sets and what it asks", () => {
	assert.equal(actionSummary(presetActions()[1]), "Sets reminders. Asks for Dates.");
});

test("an action with no property is not offered as a command", () => {
	const unfinished = { ...newAction([]), name: "Draft" };
	assert.deepEqual(actionCommands([unfinished, ...presetActions()]).map((command) => command.name), ["Set dates", "Set reminders"]);
});

test("only the stored v1 preset is renamed, not a custom action that shares its name", () => {
	const custom = { ...v1AddDates, id: "mine" };
	assert.deepEqual(mergeActions([custom]).map((action) => action.name), ["Add dates"]);
});
