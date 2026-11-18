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
import { defaultLinkStyle } from "../src/insertion/linkStyle.ts";
import { actionName, actionWarning, mergeActions, newAction, presetActions, questionOf } from "../src/actions/settings.ts";
import { effectiveMode, propertyKind, valueToWrite, writeToFrontmatter } from "../src/actions/value.ts";
import { propertyWidgetOf } from "../src/actions/propertyType.ts";
import { ActionCommands, actionCommands } from "../src/actions/commands.ts";
import { actionSummary, actionsPage } from "../src/settings/actionsPage.ts";
import { pagePath } from "../src/settings/pages.ts";
import { actionKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultSettings, mergeSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

const rowContext: SequenceContext = { now, moment, options, periods: defaultDateNotes().periods };

function notesOf(phrase: string): NoteRef[] {
	const preview = previewSequence(phrase, rowContext);
	assert.equal(preview.kind, "dates", phrase);
	return preview.kind === "dates" ? preview.notes : [];
}

const linkTo = (note: NoteRef) => `[[${note.name}]]`;

const STYLE = defaultLinkStyle();

test("presets are Add dates and Set reminders, both adding dates as links", () => {
	assert.deepEqual(presetActions(), [
		{ ...STYLE, id: "set-dates", name: "Add dates", property: "dates", mode: "add", asks: "dates", link: true },
		{ ...STYLE, id: "set-reminders", name: "Set reminders", property: "reminders", mode: "add", asks: "dates", link: true },
	]);
	assert.deepEqual(mergeSettings({ weekStart: "monday" }).actions, presetActions());
});

test("no stored actions gives the presets, an empty list stays empty, unknown keys are dropped", () => {
	assert.deepEqual(mergeActions(undefined), presetActions());
	assert.deepEqual(mergeActions({ not: "a list" }), presetActions());
	assert.deepEqual(mergeActions([]), []);
	const [action] = mergeActions([{ id: "x", name: "X", property: "p", asks: "date", link: false, extra: 1, inputs: "junk" }, "broken", 3]);
	assert.deepEqual(action, { ...STYLE, id: "x", name: "X", property: "p", mode: "add", asks: "date", link: false });
});

test("stored ids are kept unique, and loading what was saved changes nothing", () => {
	const once = mergeActions([{ id: "trip", name: "Trip", property: "p" }, { id: "trip", name: "Again", property: "p" }, { id: "a/b", name: "Slash", property: "p" }, { name: "No id" }]);
	assert.deepEqual(once.map((action) => action.id), ["trip", "action-1", "action-2", "action-3"]);
	assert.deepEqual(mergeActions(JSON.parse(JSON.stringify(once))), once);
});

test("stored fields fall back field by field, the link style included", () => {
	const [styled] = mergeActions([{ id: "s", linkPath: "fullPath", targets: ["week", "decade"], separator: "tab", template: " " }]);
	assert.deepEqual(styled, { ...STYLE, id: "s", name: "", property: "", mode: "add", asks: "dates", link: true, linkPath: "fullPath", targets: ["week"] });
	const [action] = mergeActions([{ id: "p", asks: "dates", name: 3, enabled: "yes", property: null, link: "no" }]);
	assert.deepEqual(action, { ...STYLE, id: "p", name: "", property: "", mode: "add", asks: "dates", link: true });
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

test("one command per action, re-registered when actions are renamed or removed", () => {
	const actions = presetActions();
	const { commands, host } = fakeCommandHost();
	const registry = new ActionCommands(host, ({ id, name }) => ({ id, name }));
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-set-dates", "Add dates"], ["action-set-reminders", "Set reminders"]]);
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
	assert.equal(writeControl(settings, key("link"), false), true);
	assert.equal(writeControl(settings, key("asks"), "date"), true);
	assert.equal(readControl(settings, key("mode")), "add");
	assert.equal(writeControl(settings, key("mode"), "replace"), true);
	assert.deepEqual(settings.actions[0], { ...STYLE, id: "set-dates", name: "Mine", property: "when", mode: "replace", asks: "date", link: false });
	assert.equal(writeControl(settings, key("asks"), "periodicNote"), false);
	assert.equal(writeControl(settings, key("mode"), "append"), false);
	assert.equal(writeControl(settings, key("link"), "no"), false);
	assert.equal(writeControl(settings, key("name"), 3), false);
	assert.equal(writeControl(settings, "actions/set-dates/enabled", false), false);
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
	const context = { actions: () => settings.actions, openPage: () => undefined, change: () => Promise.resolve() };
	const page = actionsPage(context);
	const [, hidden] = (page.items ?? []) as unknown as [unknown, { items: { id: string; items: unknown[] }[] }];
	assert.equal(hidden.items.length, 2);
	assert.deepEqual(controlKeysOf(hidden.items[0].items), ["name", "property", "mode", "asks", "link"].map((field) => `actions/set-dates/${field}`));
	assert.equal(pagePath([{ type: "group", items: [page] }], "action-set-reminders")?.join("/"), "actions/action-set-reminders");
	assert.equal(pagePath([page], "nowhere"), undefined);
});

test("the Actions page adds, reorders and removes actions", async () => {
	const settings = defaultSettings();
	const opened: string[] = [];
	const context = { actions: () => settings.actions, openPage: (id: string) => void opened.push(id), change: (mutate: () => unknown) => Promise.resolve(void mutate()) };
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

test("the action row says whether it adds or sets and what it asks", () => {
	assert.equal(actionSummary(presetActions()[1]), "Adds to reminders. Asks for Dates.");
	assert.equal(actionSummary({ ...presetActions()[1], mode: "replace" }), "Sets reminders. Asks for Dates.");
});

test("an action stored as disabled loads as an action and gets its command", () => {
	const actions = mergeActions([{ id: "x", name: "X", enabled: false, property: "p", mode: "add", asks: "date", link: false }]);
	assert.deepEqual(actions, [{ ...STYLE, id: "x", name: "X", property: "p", mode: "add", asks: "date", link: false }]);
	assert.deepEqual(actionCommands(actions).map((command) => command.name), ["X"]);
});

test("an action with no property is not offered as a command", () => {
	const unfinished = { ...newAction([]), name: "Draft" };
	assert.deepEqual(actionCommands([unfinished, ...presetActions()]).map((command) => command.name), ["Add dates", "Set reminders"]);
});

test("the One date picker asks the question as placeholder and says add or replace in its own text", async () => {
	const { setLanguage, DEFAULT_LANGUAGE } = await import("../src/i18n/index.ts");
	const { pickerTextOf } = await import("../src/actions/pickerText.ts");
	const action = { ...newAction([]), property: " due ", asks: "date" as const };
	const replacing = { ...action, mode: "replace" as const };
	try {
		setLanguage("en");
		assert.deepEqual(pickerTextOf(action), { placeholder: "Which date for due?", note: "The date will be added to the property due." });
		assert.deepEqual(pickerTextOf(replacing), { placeholder: "Which date for due?", note: "The date will replace the value of the property due." });
		assert.equal(pickerTextOf(action, effectiveMode(action.mode, "date")).note, "The date will replace the value of the property due.");
		setLanguage("es");
		assert.deepEqual(pickerTextOf(action), { placeholder: "¿Qué fecha para due?", note: "La fecha se añadirá a la propiedad «due»." });
		assert.deepEqual(pickerTextOf(replacing), { placeholder: "¿Qué fecha para due?", note: "La fecha sustituirá el valor de la propiedad «due»." });
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
});

test("the One date picker renders the replace sentence and the phrase picker renders no text", async () => {
	const { setLanguage, DEFAULT_LANGUAGE } = await import("../src/i18n/index.ts");
	const { pickerTextOf, pickerNoteTextOf, phrasePickerTextOf } = await import("../src/actions/pickerText.ts");
	const action = { ...newAction([]), property: "due", asks: "date" as const, mode: "replace" as const };
	try {
		setLanguage("en");
		const options = pickerTextOf(action);
		assert.ok(!options.placeholder.includes(options.note));
		assert.equal(pickerNoteTextOf(options), "The date will replace the value of the property due.");
		assert.equal(pickerNoteTextOf(phrasePickerTextOf()), undefined);
		setLanguage("es");
		assert.equal(pickerNoteTextOf(pickerTextOf(action)), "La fecha sustituirá el valor de la propiedad «due».");
		assert.equal(pickerNoteTextOf(phrasePickerTextOf()), undefined);
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
});

function frontmatterAfter(before: Record<string, unknown>, phrase: string, request: { mode: "add" | "replace"; kind?: (typeof kinds)[number]; link?: boolean }): Record<string, unknown> {
	const frontmatter = structuredClone(before);
	writeToFrontmatter(frontmatter, "dates", { notes: notesOf(phrase), link: request.link ?? true, kind: request.kind ?? "other", mode: request.mode, linkTo });
	return frontmatter;
}

test("Add on a list keeps the items and appends the new dates after them, unsorted", () => {
	const before = { title: "Trip", dates: ["[[2026-11-25]]", "[[2026-11-18]]"] };
	assert.deepEqual(frontmatterAfter(before, "nov 20 to nov 21", { mode: "add", kind: "list" }), {
		title: "Trip",
		dates: ["[[2026-11-25]]", "[[2026-11-18]]", "[[2026-11-20]]", "[[2026-11-21]]"],
	});
});

test("Add on a list skips dates already there, comparing the trimmed written value", () => {
	const before = { dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]"] };
	assert.deepEqual(frontmatterAfter(before, "nov 18 to nov 21", { mode: "add", kind: "list" }), {
		dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]", "[[2026-11-18]]", "[[2026-11-20]]", "[[2026-11-21]]"],
	});
	assert.deepEqual(frontmatterAfter(before, "nov 19 to nov 20", { mode: "add", kind: "list", link: false }), {
		dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]", "2026-11-19"],
	});
	assert.deepEqual(frontmatterAfter({ dates: ["[[2026-11-18]]"] }, "nov 18", { mode: "add", kind: "list" }), { dates: ["[[2026-11-18]]"] });
});

test("Add on a property that already holds a list appends whatever its type", () => {
	assert.deepEqual(frontmatterAfter({ dates: ["[[2026-11-18]]"] }, "nov 19", { mode: "add", kind: "other" }), { dates: ["[[2026-11-18]]", "[[2026-11-19]]"] });
});

test("Add on a list property holding one plain value turns it into a list with the new dates after it", () => {
	assert.deepEqual(frontmatterAfter({ dates: "[[2026-11-18]]" }, "nov 18 to nov 19", { mode: "add", kind: "list" }), { dates: ["[[2026-11-18]]", "[[2026-11-19]]"] });
});

test("Add on a text property holding one value appends the new dates to the text with commas", () => {
	assert.deepEqual(frontmatterAfter({ dates: "[[2026-11-18]]" }, "nov 19", { mode: "add" }), { dates: "[[2026-11-18]], [[2026-11-19]]" });
	assert.deepEqual(frontmatterAfter({ dates: "someday" }, "nov 19 to nov 20", { mode: "add", link: false }), { dates: "someday, 2026-11-19, 2026-11-20" });
	assert.deepEqual(frontmatterAfter({ dates: 2026 }, "nov 19", { mode: "add", link: false }), { dates: "2026, 2026-11-19" });
});

test("Add on a text property does not repeat a date the text already has", () => {
	assert.deepEqual(frontmatterAfter({ dates: "[[2026-11-18]], [[2026-11-19]]" }, "nov 18 to nov 20", { mode: "add" }), { dates: "[[2026-11-18]], [[2026-11-19]], [[2026-11-20]]" });
	assert.deepEqual(frontmatterAfter({ dates: "[[2026-11-18]]" }, "nov 18", { mode: "add" }), { dates: "[[2026-11-18]]" });
});

test("Add on an empty or missing property writes the same shape as Replace", () => {
	for (const before of [{}, { dates: null }, { dates: "" }, { dates: "  " }]) {
		assert.deepEqual(frontmatterAfter(before, "nov 18", { mode: "add" }), { dates: "[[2026-11-18]]" });
		assert.deepEqual(frontmatterAfter(before, "nov 18 to nov 19", { mode: "add" }), { dates: ["[[2026-11-18]]", "[[2026-11-19]]"] });
		assert.deepEqual(frontmatterAfter(before, "nov 18", { mode: "add", kind: "list" }), { dates: ["[[2026-11-18]]"] });
	}
	assert.deepEqual(frontmatterAfter({ dates: [] }, "nov 18", { mode: "add" }), { dates: ["[[2026-11-18]]"] });
});

test("Add on a date or date and time property replaces, because it holds one value", () => {
	assert.deepEqual(frontmatterAfter({ dates: "2026-11-01" }, "nov 18", { mode: "add", kind: "date", link: false }), { dates: "2026-11-18" });
	assert.deepEqual(frontmatterAfter({ dates: "2026-11-01T09:00" }, "nov 18", { mode: "add", kind: "datetime", link: false }), { dates: "2026-11-18T00:00" });
	assert.deepEqual(kinds.map((kind) => effectiveMode("add", kind)), ["replace", "replace", "add", "add"]);
	assert.deepEqual(kinds.map((kind) => effectiveMode("replace", kind)), ["replace", "replace", "replace", "replace"]);
});

test("Replace overwrites the value and leaves the other properties alone", () => {
	assert.deepEqual(frontmatterAfter({ title: "Trip", dates: "[[2026-11-01]]" }, "nov 18", { mode: "replace" }), { title: "Trip", dates: "[[2026-11-18]]" });
	assert.deepEqual(frontmatterAfter({ dates: "[[2026-11-01]]" }, "nov 18 to nov 19", { mode: "replace" }), { dates: ["[[2026-11-18]]", "[[2026-11-19]]"] });
	assert.deepEqual(frontmatterAfter({ dates: ["[[2026-11-01]]", "[[2026-11-02]]"] }, "nov 18", { mode: "replace" }), { dates: ["[[2026-11-18]]"] });
	assert.deepEqual(frontmatterAfter({ dates: ["[[2026-11-01]]"] }, "nov 18", { mode: "replace", kind: "list" }), { dates: ["[[2026-11-18]]"] });
});

test("a stored action with no mode adds, a stored mode is kept, and an unknown one adds", () => {
	const stored = (mode?: unknown) => ({ id: "x", name: "X", property: "p", asks: "dates", link: true, ...(mode === undefined ? {} : { mode }) });
	assert.deepEqual([stored(), stored("replace"), stored("add"), stored("sort")].map((entry) => mergeActions([entry])[0].mode), ["add", "replace", "add", "add"]);
	assert.equal(newAction([]).mode, "add");
});

test("the action page offers Add and Replace right after the property", () => {
	const settings = defaultSettings();
	const page = actionsPage({ actions: () => settings.actions, openPage: () => undefined, change: () => Promise.resolve() });
	const [, hidden] = (page.items ?? []) as unknown as [unknown, { items: { items: { items: { name: string; control: { type: string; key: string; options?: Record<string, string> } }[] }[] }[] }];
	const fields = hidden.items[0].items[0].items;
	assert.equal(fields[1].control.key, "actions/set-dates/property");
	assert.equal(fields[2].name, "When the property already has a value");
	assert.deepEqual(fields[2].control, { type: "dropdown", key: "actions/set-dates/mode", options: { add: "Add", replace: "Replace" } });
});
