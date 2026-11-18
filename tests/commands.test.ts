import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Command } from "obsidian";
import { moment } from "./moment.ts";
import { cursorAndPropertyCommands, dateNotesWithoutQuarter, settingsWithPropertyCommands } from "./fixtures.ts";
import type { ParseOptions } from "../src/parse/index.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import { previewSequence } from "../src/sequence/preview.ts";
import type { SequenceContext } from "../src/sequence/preview.ts";
import { linkTarget } from "../src/insertion/property.ts";
import { defaultLinkStyle } from "../src/insertion/linkStyle.ts";
import { commandName, commandWarning, mergeCommands, newCommand, presetCommands, questionOf } from "../src/commands/settings.ts";
import { effectiveMode, propertyKind, valueToWrite, writeToFrontmatter } from "../src/commands/value.ts";
import { propertyWidgetOf } from "../src/commands/propertyType.ts";
import { PaletteCommands, paletteCommands } from "../src/commands/palette.ts";
import { commandSummary, commandsPage } from "../src/settings/commandsPage.ts";
import type { CommandsPageContext } from "../src/settings/commandsPage.ts";
import type { DateCompassSettings } from "../src/settings.ts";
import { pagePath } from "../src/settings/pages.ts";
import { commandKey, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { mergeSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

const rowContext: SequenceContext = { now, moment, options, periods: dateNotesWithoutQuarter().periods };

function notesOf(phrase: string): NoteRef[] {
	const preview = previewSequence(phrase, rowContext);
	assert.equal(preview.kind, "dates", phrase);
	return preview.kind === "dates" ? preview.notes : [];
}

const linkTo = (note: NoteRef) => `[[${note.name}]]`;

const STYLE = defaultLinkStyle();

const [INSERT_DATES, ADD_DATES, SET_REMINDERS] = cursorAndPropertyCommands();

test("the only preset is Insert dates at the cursor", () => {
	assert.deepEqual(presetCommands(), [
		{ ...STYLE, id: "insert-dates", name: "Insert dates", destination: "cursor", property: "", mode: "add", asks: "dates", link: true },
	]);
	assert.deepEqual(mergeSettings({ weekStart: "monday" }).commands, presetCommands());
});

test("stored actions are ignored and commands that are not a list give the presets", () => {
	const stored = [{ id: "old", name: "Old", property: "p", mode: "replace", asks: "date", link: false }];
	assert.deepEqual(mergeSettings({ actions: stored }).commands, presetCommands());
	assert.deepEqual(mergeSettings({ actions: stored, commands: "none" }).commands, presetCommands());
	assert.deepEqual(mergeSettings({ actions: stored, commands: [] }).commands, []);
	assert.equal("actions" in mergeSettings({ actions: stored }), false);
});

test("a stored destination is kept, and a missing or unknown one writes to a property", () => {
	const stored = (destination?: unknown) => ({ id: "x", name: "X", property: "p", ...(destination === undefined ? {} : { destination }) });
	assert.deepEqual([stored(), stored("cursor"), stored("property"), stored("clipboard"), stored(3)].map((entry) => mergeCommands([entry])[0].destination), ["property", "cursor", "property", "property", "property"]);
	assert.equal(newCommand([]).destination, "property");
});

test("no stored commands gives the presets, an empty list stays empty, unknown keys are dropped", () => {
	assert.deepEqual(mergeCommands(undefined), presetCommands());
	assert.deepEqual(mergeCommands({ not: "a list" }), presetCommands());
	assert.deepEqual(mergeCommands([]), []);
	const [command] = mergeCommands([{ id: "x", name: "X", property: "p", asks: "date", link: false, extra: 1, inputs: "junk" }, "broken", 3]);
	assert.deepEqual(command, { ...STYLE, id: "x", name: "X", destination: "property", property: "p", mode: "add", asks: "date", link: false });
});

test("stored ids are kept unique, and loading what was saved changes nothing", () => {
	const once = mergeCommands([{ id: "trip", name: "Trip", property: "p" }, { id: "trip", name: "Again", property: "p" }, { id: "a/b", name: "Slash", property: "p" }, { name: "No id" }]);
	assert.deepEqual(once.map((command) => command.id), ["trip", "command-1", "command-2", "command-3"]);
	assert.deepEqual(mergeCommands(JSON.parse(JSON.stringify(once))), once);
});

test("stored fields fall back field by field, the link style included", () => {
	const [styled] = mergeCommands([{ id: "s", linkPath: "fullPath", targets: ["week", "decade"], separator: "tab", template: " " }]);
	assert.deepEqual(styled, { ...STYLE, id: "s", name: "", destination: "property", property: "", mode: "add", asks: "dates", link: true, linkPath: "fullPath", targets: ["week"] });
	const [command] = mergeCommands([{ id: "p", asks: "dates", name: 3, enabled: "yes", property: null, link: "no" }]);
	assert.deepEqual(command, { ...STYLE, id: "p", name: "", destination: "property", property: "", mode: "add", asks: "dates", link: true });
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

test("the question a command asks names its property and what it takes", () => {
	assert.equal(questionOf({ ...ADD_DATES, property: " dates " }), "Which dates for dates?");
	assert.equal(questionOf({ ...ADD_DATES, asks: "date", property: "due" }), "Which date for due?");
	assert.equal(questionOf(INSERT_DATES), "Insert dates");
});

test("a command without a property is flagged", () => {
	assert.equal(commandWarning(newCommand([])), "Enter the property this command sets.");
	assert.equal(commandWarning(ADD_DATES), undefined);
	assert.equal(commandWarning({ ...ADD_DATES, property: "  " }), "Enter the property this command sets.");
	assert.equal(commandWarning({ ...INSERT_DATES, property: "" }), undefined);
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

test("one palette command per command, re-registered when commands are renamed or removed", () => {
	const commands = cursorAndPropertyCommands();
	const { commands: registered, host } = fakeCommandHost();
	const registry = new PaletteCommands(host, ({ id, name }) => ({ id, name }));
	registry.sync(commands);
	assert.deepEqual([...registered], [["command-insert-dates", "Insert dates"], ["command-set-dates", "Add dates"], ["command-set-reminders", "Set reminders"]]);
	commands[1].name = "Plan trip";
	registry.sync(commands);
	assert.deepEqual([...registered].sort(), [["command-insert-dates", "Insert dates"], ["command-set-dates", "Plan trip"], ["command-set-reminders", "Set reminders"]]);
	commands.splice(0, 2);
	registry.sync(commands);
	assert.deepEqual([...registered], [["command-set-reminders", "Set reminders"]]);
	assert.deepEqual(paletteCommands([{ ...newCommand([]), name: "  ", property: "p" }]).map((command) => command.name), ["Untitled command"]);
	assert.equal(commandName({ ...newCommand([]), name: " Go " }), "Go");
});

test("the command controls read and write every field of a command and refuse bad values", () => {
	const settings = settingsWithPropertyCommands();
	const key = (field: Parameters<typeof commandKey>[1]) => commandKey("set-dates", field);
	assert.equal(readControl(settings, key("property")), "dates");
	assert.equal(writeControl(settings, key("property"), "when"), true);
	assert.equal(writeControl(settings, key("name"), "Mine"), true);
	assert.equal(writeControl(settings, key("link"), false), true);
	assert.equal(writeControl(settings, key("asks"), "date"), true);
	assert.equal(readControl(settings, key("mode")), "add");
	assert.equal(writeControl(settings, key("mode"), "replace"), true);
	assert.equal(readControl(settings, key("destination")), "property");
	assert.equal(writeControl(settings, key("destination"), "cursor"), true);
	assert.equal(writeControl(settings, key("destination"), "clipboard"), false);
	assert.deepEqual(settings.commands[1], { ...STYLE, id: "set-dates", name: "Mine", destination: "cursor", property: "when", mode: "replace", asks: "date", link: false });
	assert.equal(writeControl(settings, key("asks"), "periodicNote"), false);
	assert.equal(writeControl(settings, key("mode"), "append"), false);
	assert.equal(writeControl(settings, key("link"), "no"), false);
	assert.equal(writeControl(settings, key("name"), 3), false);
	assert.equal(writeControl(settings, "commands/set-dates/enabled", false), false);
	assert.equal(writeControl(settings, commandKey("missing", "name"), "x"), false);
	assert.equal(writeControl(settings, "commands/set-dates/inputs/x/key", "x"), false);
});

function pageContext(settings: DateCompassSettings): CommandsPageContext {
	return {
		commands: () => settings.commands,
		openPage: () => undefined,
		change: () => Promise.resolve(),
		today: () => now,
		write: () => undefined,
		isEnabledInDateNotes: () => true,
		chooseTarget: () => undefined,
		notify: () => undefined,
	};
}

function controlKeysOf(items: readonly unknown[]): string[] {
	return items.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const record = item as { control?: { key: string }; items?: unknown[] };
		return [...(record.control ? [record.control.key] : []), ...controlKeysOf(record.items ?? [])];
	});
}

test("each command has one page with all its fields and nothing nests below it", () => {
	const settings = settingsWithPropertyCommands();
	const page = commandsPage(pageContext(settings));
	const [, hidden] = (page.items ?? []) as unknown as [unknown, { items: { id: string; items: unknown[] }[] }];
	assert.equal(hidden.items.length, 3);
	assert.deepEqual(controlKeysOf(hidden.items[1].items), ["name", "destination", "property", "mode", "asks", "link", "linkPath", "aliasShape"].map((field) => `commands/set-dates/${field}`));
	assert.deepEqual(controlKeysOf(hidden.items[0].items), ["name", "destination", "asks", "link", "template", "linkPath", "separator", "aliasShape"].map((field) => `commands/insert-dates/${field}`));
	assert.equal(pagePath([{ type: "group", items: [page] }], "command-set-reminders")?.join("/"), "commands/command-set-reminders");
	assert.equal(pagePath([page], "nowhere"), undefined);
});

test("the Commands page adds, reorders and removes commands", async () => {
	const settings = settingsWithPropertyCommands();
	const opened: string[] = [];
	const context = { ...pageContext(settings), openPage: (id: string) => void opened.push(id), change: (mutate: () => unknown) => Promise.resolve(void mutate()) };
	type ListLike = { onReorder?: (a: number, b: number) => void; onDelete?: (index: number) => void; addItem?: { action: (el: HTMLElement) => void } };
	const [commandsList] = (commandsPage(context).items ?? []) as unknown as [ListLike];
	commandsList.onReorder?.(0, 1);
	assert.deepEqual(settings.commands.map((command) => command.id), ["set-dates", "insert-dates", "set-reminders"]);
	commandsList.addItem?.action({} as HTMLElement);
	await Promise.resolve();
	assert.match(opened[0], /^command-command-[a-z0-9]+-1$/);
	commandsList.onDelete?.(3);
	assert.deepEqual(settings.commands.map((command) => command.id), ["set-dates", "insert-dates", "set-reminders"]);
});

test("a new command never reuses the id, and so the command, of a removed one", () => {
	const commands = cursorAndPropertyCommands();
	const first = newCommand(commands, 1);
	commands.push(first);
	commands.splice(commands.indexOf(first), 1);
	assert.equal(newCommand(commands, 1).id, first.id);
	assert.notEqual(newCommand([first], 1).id, first.id);
});

test("the command row says where it writes, whether it adds or sets, and what it asks", () => {
	assert.equal(commandSummary(SET_REMINDERS), "Adds to reminders. Asks for Dates.");
	assert.equal(commandSummary({ ...SET_REMINDERS, mode: "replace" }), "Sets reminders. Asks for Dates.");
	assert.equal(commandSummary(INSERT_DATES), "Inserts at the cursor. Asks for Dates.");
	assert.equal(commandSummary({ ...SET_REMINDERS, destination: "cursor", asks: "date" }), "Inserts at the cursor. Asks for One date.");
});

test("a command stored as disabled loads as a command and gets its command", () => {
	const commands = mergeCommands([{ id: "x", name: "X", enabled: false, property: "p", mode: "add", asks: "date", link: false }]);
	assert.deepEqual(commands, [{ ...STYLE, id: "x", name: "X", destination: "property", property: "p", mode: "add", asks: "date", link: false }]);
	assert.deepEqual(paletteCommands(commands).map((command) => command.name), ["X"]);
});

test("a command with no property is not offered as a command", () => {
	const unfinished = { ...newCommand([]), name: "Draft" };
	assert.deepEqual(paletteCommands([unfinished, ...cursorAndPropertyCommands()]).map((command) => command.name), ["Insert dates", "Add dates", "Set reminders"]);
});

test("the One date picker asks the question as placeholder and says add or replace in its own text", async () => {
	const { setLanguage, DEFAULT_LANGUAGE } = await import("../src/i18n/index.ts");
	const { pickerTextOf } = await import("../src/commands/pickerText.ts");
	const command = { ...newCommand([]), property: " due ", asks: "date" as const };
	const replacing = { ...command, mode: "replace" as const };
	try {
		setLanguage("en");
		assert.deepEqual(pickerTextOf(command), { placeholder: "Which date for due?", note: "The date will be added to the property due." });
		assert.deepEqual(pickerTextOf(replacing), { placeholder: "Which date for due?", note: "The date will replace the value of the property due." });
		assert.equal(pickerTextOf(command, effectiveMode(command.mode, "date")).note, "The date will replace the value of the property due.");
		setLanguage("es");
		assert.deepEqual(pickerTextOf(command), { placeholder: "¿Qué fecha para due?", note: "La fecha se añadirá a la propiedad «due»." });
		assert.deepEqual(pickerTextOf(replacing), { placeholder: "¿Qué fecha para due?", note: "La fecha sustituirá el valor de la propiedad «due»." });
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
});

test("the One date picker renders the replace sentence and the phrase picker renders no text", async () => {
	const { setLanguage, DEFAULT_LANGUAGE } = await import("../src/i18n/index.ts");
	const { pickerTextOf, pickerNoteTextOf, phrasePickerTextOf } = await import("../src/commands/pickerText.ts");
	const command = { ...newCommand([]), property: "due", asks: "date" as const, mode: "replace" as const };
	try {
		setLanguage("en");
		const options = pickerTextOf(command);
		assert.ok(!options.placeholder.includes(options.note));
		assert.equal(pickerNoteTextOf(options), "The date will replace the value of the property due.");
		assert.equal(pickerNoteTextOf(phrasePickerTextOf()), undefined);
		setLanguage("es");
		assert.equal(pickerNoteTextOf(pickerTextOf(command)), "La fecha sustituirá el valor de la propiedad «due».");
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

test("Add on a list skips dates already there, comparing links by their target and the rest by the trimmed written value", () => {
	const before = { dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]"] };
	assert.deepEqual(frontmatterAfter(before, "nov 18 to nov 21", { mode: "add", kind: "list" }), {
		dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]", "[[2026-11-18]]", "[[2026-11-20]]"],
	});
	assert.deepEqual(frontmatterAfter(before, "nov 19 to nov 20", { mode: "add", kind: "list", link: false }), {
		dates: [" [[2026-11-19]] ", "2026-11-20", "[[2026-11-21|Sat]]", "2026-11-19"],
	});
	assert.deepEqual(frontmatterAfter({ dates: ["[[2026-11-18]]"] }, "nov 18", { mode: "add", kind: "list" }), { dates: ["[[2026-11-18]]"] });
});

function frontmatterAfterAliased(before: Record<string, unknown>, phrase: string, kind: (typeof kinds)[number]): Record<string, unknown> {
	const frontmatter = structuredClone(before);
	const aliased = (note: NoteRef) => `[[${note.name}|${note.date.format("ddd D MMM")}]]`;
	writeToFrontmatter(frontmatter, "dates", { notes: notesOf(phrase), link: true, kind, mode: "add", linkTo: aliased });
	return frontmatter;
}

test("Add skips a note whose link is already in the property, whatever the alias of either", () => {
	assert.deepEqual(frontmatterAfterAliased({ dates: ["[[2026-02-14]]"] }, "2026-02-14", "list"), { dates: ["[[2026-02-14]]"] });
	assert.deepEqual(frontmatterAfterAliased({ dates: ["[[2026-02-14|Valentine]]"] }, "2026-02-14", "list"), { dates: ["[[2026-02-14|Valentine]]"] });
	assert.deepEqual(frontmatterAfterAliased({ dates: ["[[2026-02-14]]"] }, "2026-02-15", "list"), { dates: ["[[2026-02-14]]", "[[2026-02-15|Sun 15 Feb]]"] });
	assert.deepEqual(frontmatterAfterAliased({ dates: ["2026-02-14"] }, "2026-02-14", "list"), { dates: ["2026-02-14", "[[2026-02-14|Sat 14 Feb]]"] });
	assert.deepEqual(frontmatterAfterAliased({ dates: "[[2026-02-14]], [[2026-02-16|Mon]]" }, "2026-02-14 to 2026-02-16", "other"), { dates: "[[2026-02-14]], [[2026-02-16|Mon]], [[2026-02-15|Sun 15 Feb]]" });
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

test("a stored command with no mode adds, a stored mode is kept, and an unknown one adds", () => {
	const stored = (mode?: unknown) => ({ id: "x", name: "X", property: "p", asks: "dates", link: true, ...(mode === undefined ? {} : { mode }) });
	assert.deepEqual([stored(), stored("replace"), stored("add"), stored("sort")].map((entry) => mergeCommands([entry])[0].mode), ["add", "replace", "add", "add"]);
	assert.equal(newCommand([]).mode, "add");
});

test("the command page offers Add and Replace right after the property", () => {
	const settings = settingsWithPropertyCommands();
	const page = commandsPage(pageContext(settings));
	const [, hidden] = (page.items ?? []) as unknown as [unknown, { items: { items: { items: { name: string; control: { type: string; key: string; options?: Record<string, string> } }[] }[] }[] }];
	const fields = hidden.items[1].items[0].items;
	assert.equal(fields[2].control.key, "commands/set-dates/property");
	assert.equal(fields[3].name, "When the property already has a value");
	assert.deepEqual(fields[3].control, { type: "dropdown", key: "commands/set-dates/mode", options: { add: "Add", replace: "Replace" } });
});
