import { test } from "node:test";
import { strict as assert } from "node:assert";
import { moment } from "./moment.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import type { LinkBuilders } from "../src/insertion/linksToWrite.ts";
import { mergeCommands, newCommand } from "../src/commands/settings.ts";
import type { DateCommand } from "../src/commands/settings.ts";
import { paletteCommands } from "../src/commands/palette.ts";
import { datesQuestionFor, pickerTextFor } from "../src/commands/pickerText.ts";
import { writeToFrontmatter } from "../src/commands/value.ts";
import type { PropertyKind } from "../src/commands/value.ts";
import { aliasChosen, aliasedPropertyLink, cursorTarget, offersAlias, propertyTarget, textsToWrite } from "../src/commands/write.ts";
import type { WriteTarget } from "../src/commands/write.ts";
import { commandsPage } from "../src/settings/commandsPage.ts";
import { commandKey, commandKeyParts, commandPageRefresh, mentionKeyParts, readControl, writeControl } from "../src/settings/controlKeys.ts";
import { defaultSettings } from "../src/settings.ts";
import { cursorAndPropertyCommands, settingsWithPropertyCommands } from "./fixtures.ts";

function dayNote(isoDate: string): NoteRef {
	const start = moment(isoDate, "YYYY-MM-DD");
	return { period: "day", start, date: start, name: isoDate, path: `daily/${isoDate}.md` };
}

const NOTES = [dayNote("2026-11-23"), dayNote("2026-11-24")];

const LINKS: LinkBuilders = {
	body: (note, alias) => (alias === undefined ? `[${note.name}](${note.path})` : `[${alias}](${note.path})`),
	property: (note, alias) => (alias === undefined ? `[[${note.name}]]` : `[[${note.name}|${alias}]]`),
};

const [INSERT_DATES, ADD_DATES] = cursorAndPropertyCommands();

const TASKS: DateCommand = { ...INSERT_DATES, template: "- {{link}} ({{date:YYYY}})", aliasFormat: "D MMM" };

const BODY: WriteTarget = { kind: "body" };

const UNDER_CURSOR: WriteTarget = { kind: "propertyUnderCursor", property: "dates" };

const CONFIGURED: WriteTarget = { kind: "property", property: "dates", mode: "add" };

interface Written {
	command?: DateCommand;
	target: WriteTarget;
	withAlias?: boolean;
	kind?: PropertyKind;
	notes?: NoteRef[];
	phrase?: string;
}

function written({ command = TASKS, target, withAlias = false, kind = "other", notes = NOTES, phrase = "mon to tue" }: Written): string[] {
	return textsToWrite({ command, target, kind, notes, phrase, withAlias, links: LINKS });
}

test("palette commands carry the id command-<id> and say whether they need an editor", () => {
	assert.deepEqual(
		paletteCommands(cursorAndPropertyCommands()).map(({ id, name, needsEditor }) => ({ id, name, needsEditor })),
		[
			{ id: "command-insert-dates", name: "Insert dates", needsEditor: true },
			{ id: "command-set-dates", name: "Add dates", needsEditor: false },
			{ id: "command-set-reminders", name: "Set reminders", needsEditor: false },
		],
	);
});

test("a cursor command is registered without a property, a property command without one is not", () => {
	const blank = { ...newCommand([], 1), name: "Draft" };
	const atCursor: DateCommand = { ...blank, id: "here", destination: "cursor" };
	assert.deepEqual(paletteCommands([blank]), []);
	assert.deepEqual(paletteCommands([blank, atCursor]).map((command) => command.id), ["command-here"]);
	assert.deepEqual(paletteCommands([{ ...blank, property: " due " }]).map((command) => command.needsEditor), [false]);
});

test("the cursor decides where a cursor command writes", () => {
	assert.deepEqual(cursorTarget({ kind: "body" }, true), { kind: "body" });
	assert.deepEqual(cursorTarget({ kind: "property", name: "due" }, true), { kind: "propertyUnderCursor", property: "due" });
	assert.deepEqual(cursorTarget({ kind: "property", name: "due" }, false), { kind: "body" });
	assert.deepEqual(cursorTarget({ kind: "frontmatterWithoutProperty" }, true), { kind: "noProperty" });
	assert.deepEqual(propertyTarget({ property: " due ", mode: "replace" }), { kind: "property", property: "due", mode: "replace" });
});

test("at the cursor in the note body links go through the template, with the alias when asked", () => {
	assert.deepEqual(written({ target: BODY }), ["- [2026-11-23](daily/2026-11-23.md) (2026)", "- [2026-11-24](daily/2026-11-24.md) (2026)"]);
	assert.deepEqual(written({ target: BODY, withAlias: true }), ["- [23 Nov](daily/2026-11-23.md) (2026)", "- [24 Nov](daily/2026-11-24.md) (2026)"]);
});

test("at the cursor in the note body without links {{link}} is the note name, or the alias when asked", () => {
	const plain = { ...TASKS, link: false };
	assert.deepEqual(written({ command: plain, target: BODY }), ["- 2026-11-23 (2026)", "- 2026-11-24 (2026)"]);
	assert.deepEqual(written({ command: plain, target: BODY, withAlias: true }), ["- 23 Nov (2026)", "- 24 Nov (2026)"]);
	const typed: DateCommand = { ...plain, aliasShape: "typed" };
	assert.deepEqual(written({ command: typed, target: BODY, withAlias: true, notes: NOTES.slice(0, 1), phrase: "monday" }), ["- monday (2026)"]);
	assert.deepEqual(written({ command: typed, target: BODY, withAlias: true }), ["- 2026-11-23 (2026)", "- 2026-11-24 (2026)"]);
});

test("the template is skipped in a property under the cursor", () => {
	assert.deepEqual(written({ target: UNDER_CURSOR }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(written({ target: UNDER_CURSOR, withAlias: true }), ["[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"]);
	assert.deepEqual(written({ command: { ...TASKS, template: "{{name}} {{alias}}" }, target: UNDER_CURSOR }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
});

test("a property without links gets what property commands write, by property type, and never an alias", () => {
	const plain = { ...TASKS, link: false };
	for (const target of [UNDER_CURSOR, CONFIGURED]) {
		assert.deepEqual(written({ command: plain, target }), ["2026-11-23", "2026-11-24"]);
		assert.deepEqual(written({ command: plain, target, withAlias: true }), ["2026-11-23", "2026-11-24"]);
		assert.deepEqual(written({ command: plain, target, kind: "datetime" }), ["2026-11-23T00:00", "2026-11-24T00:00"]);
	}
	const week: NoteRef = { period: "week", start: moment("2026-11-23", "YYYY-MM-DD"), date: moment("2026-11-26", "YYYY-MM-DD"), name: "2026-W48", path: "2026-W48.md" };
	assert.deepEqual(written({ command: plain, target: UNDER_CURSOR, notes: [week] }), ["2026-W48"]);
	assert.deepEqual(written({ command: plain, target: UNDER_CURSOR, notes: [week], kind: "date" }), ["2026-11-26"]);
});

test("a property command writes bare links, aliased only when asked and the property is not a date", () => {
	const command = { ...ADD_DATES, template: "- {{link}}", aliasFormat: "D MMM" };
	assert.deepEqual(written({ command, target: CONFIGURED }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(written({ command, target: CONFIGURED, withAlias: true }), ["[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"]);
	assert.deepEqual(written({ command, target: CONFIGURED, withAlias: true, kind: "list" }), ["[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"]);
	assert.deepEqual(written({ command, target: CONFIGURED, withAlias: true, kind: "date" }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
	assert.deepEqual(written({ command, target: CONFIGURED, withAlias: true, kind: "datetime" }), ["[[2026-11-23]]", "[[2026-11-24]]"]);
});

test("a property command adds aliased links to its property", () => {
	const command = { ...ADD_DATES, aliasFormat: "D MMM" };
	const frontmatter: Record<string, unknown> = { dates: ["[[2026-11-01]]"] };
	const linkTo = aliasedPropertyLink({ command, target: CONFIGURED, kind: "list", notes: NOTES, phrase: "mon to tue", withAlias: true, links: LINKS });
	writeToFrontmatter(frontmatter, "dates", { notes: NOTES, link: true, kind: "list", mode: "add", linkTo });
	assert.deepEqual(frontmatter, { dates: ["[[2026-11-01]]", "[[2026-11-23|23 Nov]]", "[[2026-11-24|24 Nov]]"] });
});

test("link text is offered in the note body always, and in a property only for links outside date types", () => {
	const kinds: PropertyKind[] = ["other", "list", "date", "datetime"];
	const plain = { link: false };
	const linked = { link: true };
	assert.deepEqual(kinds.map((kind) => offersAlias(linked, BODY, kind)), [true, true, true, true]);
	assert.deepEqual(kinds.map((kind) => offersAlias(plain, BODY, kind)), [true, true, true, true]);
	for (const target of [UNDER_CURSOR, CONFIGURED]) {
		assert.deepEqual(kinds.map((kind) => offersAlias(linked, target, kind)), [true, true, false, false]);
		assert.deepEqual(kinds.map((kind) => offersAlias(plain, target, kind)), [false, false, false, false]);
	}
});

test("Alt+Enter in the One date picker asks for the link text only where it is offered", () => {
	assert.equal(aliasChosen(true, { altKey: true }), true);
	assert.equal(aliasChosen(true, { altKey: false }), false);
	assert.equal(aliasChosen(false, { altKey: true }), false);
	assert.equal(aliasChosen(false, { altKey: false }), false);
});

test("the question of a cursor command carries its name and names the property under the cursor", () => {
	const one: DateCommand = { ...INSERT_DATES, asks: "date" };
	assert.deepEqual(datesQuestionFor(INSERT_DATES, BODY, "other"), { title: "Insert dates" });
	assert.deepEqual(datesQuestionFor(INSERT_DATES, UNDER_CURSOR, "other"), { title: "Insert dates", propertyName: "dates" });
	assert.deepEqual(pickerTextFor(one, BODY, "other"), { placeholder: "Type a date, such as next month or last wed" });
	assert.deepEqual(pickerTextFor(one, UNDER_CURSOR, "other"), { placeholder: "Type a date, such as next month or last wed", note: "The date will be added to the property dates." });
});

test("the question of a property command names its property and whether it adds or replaces", () => {
	assert.deepEqual(datesQuestionFor(ADD_DATES, CONFIGURED, "list"), { title: "Which dates for dates?", propertyName: "dates", replacesProperty: false });
	assert.deepEqual(datesQuestionFor(ADD_DATES, CONFIGURED, "date"), { title: "Which dates for dates?", propertyName: "dates", replacesProperty: true });
	assert.deepEqual(datesQuestionFor(ADD_DATES, { ...CONFIGURED, mode: "replace" }, "other"), { title: "Which dates for dates?", propertyName: "dates", replacesProperty: true });
	const one: DateCommand = { ...ADD_DATES, asks: "date" };
	assert.deepEqual(pickerTextFor(one, CONFIGURED, "other"), { placeholder: "Which date for dates?", note: "The date will be added to the property dates." });
	assert.deepEqual(pickerTextFor(one, CONFIGURED, "date"), { placeholder: "Which date for dates?", note: "The date will replace the value of the property dates." });
});

test("the link style of a command falls back field by field", () => {
	const [command] = mergeCommands([{ id: "c", destination: "cursor", template: "- {{link}}", linkPath: "nowhere", separator: "lines", aliasShape: "typed", aliasFormat: " ", targets: ["day", "day", "era"] }]);
	assert.deepEqual(command, { ...INSERT_DATES, id: "c", name: "", template: "- {{link}}", separator: "lines", aliasShape: "typed", targets: ["day"] });
	assert.deepEqual(mergeCommands([{ id: "c", targets: [] }])[0].targets, ["day", "week", "month", "quarter", "year"]);
});

test("command control keys are commands/<id>/<field>, link style fields included", () => {
	assert.equal(commandKey("set-dates", "destination"), "commands/set-dates/destination");
	assert.equal(commandKey("set-dates", "aliasFormat"), "commands/set-dates/aliasFormat");
	assert.deepEqual(commandKeyParts("commands/set-dates/template"), { commandId: "set-dates", field: "template" });
	assert.equal(commandKeyParts("commands/set-dates/trigger"), undefined);
	assert.equal(commandKeyParts("commands/set-dates/name/more"), undefined);
	assert.equal(commandKeyParts("actions/set-dates/name"), undefined);
	assert.equal(commandKeyParts("mentions/mention-1/template"), undefined);
	assert.equal(mentionKeyParts("commands/set-dates/template"), undefined);
});

test("the link style of a command is read and written through its control keys", () => {
	const settings = settingsWithPropertyCommands();
	const key = (field: Parameters<typeof commandKey>[1]) => commandKey("insert-dates", field);
	assert.equal(readControl(settings, key("template")), "{{link}}");
	assert.equal(writeControl(settings, key("template"), "- {{link}}"), true);
	assert.equal(writeControl(settings, key("template"), "  "), false);
	assert.equal(writeControl(settings, key("separator"), "lines"), true);
	assert.equal(writeControl(settings, key("linkPath"), "fullPath"), true);
	assert.equal(writeControl(settings, key("aliasShape"), "typed"), true);
	assert.equal(writeControl(settings, key("aliasFormat"), " D MMM "), true);
	assert.equal(writeControl(settings, key("targets"), ["day", "week"]), true);
	assert.equal(writeControl(settings, key("targets"), []), false);
	assert.equal(writeControl(settings, key("separator"), "tab"), false);
	assert.deepEqual(settings.commands[0], { ...INSERT_DATES, template: "- {{link}}", separator: "lines", linkPath: "fullPath", aliasShape: "typed", aliasFormat: "D MMM", targets: ["day", "week"] });
	assert.deepEqual(settings.commands[1], ADD_DATES);
	assert.deepEqual(settings.mentions, defaultSettings().mentions);
	assert.equal(readControl(settings, "actions/insert-dates/template"), undefined);
	assert.equal(writeControl(settings, "actions/insert-dates/template", "x {{link}}"), false);
});

test("the settings page is redrawn at once for fields that change it, after typing for the row text, and not for the rest", () => {
	const refresh = (field: Parameters<typeof commandKey>[1]) => commandPageRefresh(commandKey("set-dates", field));
	assert.deepEqual((["destination", "mode", "asks", "link", "targets", "aliasShape"] as const).map(refresh), ["now", "now", "now", "now", "now", "now"]);
	assert.deepEqual((["name", "property"] as const).map(refresh), ["afterTyping", "afterTyping"]);
	assert.deepEqual((["template", "linkPath", "separator", "aliasFormat"] as const).map(refresh), ["none", "none", "none", "none"]);
	assert.equal(commandPageRefresh("mentions/mention-1/template"), undefined);
	assert.equal(commandPageRefresh("weekStart"), undefined);
});

interface ItemLike {
	type?: string;
	id?: string;
	name?: string;
	desc?: string;
	heading?: string;
	control?: { type: string; key: string; options?: Record<string, string> };
	items?: ItemLike[];
}

function namesOf(items: readonly ItemLike[]): string[] {
	return items.flatMap((item) => (item.type === "group" ? namesOf(item.items ?? []) : [item.heading ?? item.name ?? ""]));
}

function commandPageOf(command: DateCommand): ItemLike {
	const page = commandsPage({
		commands: () => [command],
		openPage: () => undefined,
		change: () => Promise.resolve(),
		today: () => moment("2026-11-17", "YYYY-MM-DD"),
		write: () => undefined,
		isEnabledInDateNotes: () => true,
		chooseTarget: () => undefined,
		notify: () => undefined,
		ribbon: { listed: () => [], source: () => defaultSettings(), appliesLive: () => true, change: () => undefined, choose: () => undefined, notify: () => undefined },
	});
	const [, hidden] = (page.items ?? []) as unknown as [ItemLike, ItemLike];
	return (hidden.items ?? [])[0];
}

test("a property command page shows the property and add or replace, and no template or separator", () => {
	const page = commandPageOf(ADD_DATES);
	assert.equal(page.id, "command-set-dates");
	assert.deepEqual(namesOf(page.items ?? []), [
		"Name",
		"Where it writes",
		"Property to set",
		"When the property already has a value",
		"What it asks for",
		"Each date as link",
		"Target periods",
		"Path in each link",
		"What the link text says",
		"Date format of the link text",
	]);
});

test("a cursor command page hides the property fields and shows the template and separator for the note body", () => {
	const page = commandPageOf(INSERT_DATES);
	assert.deepEqual(namesOf(page.items ?? []), [
		"Name",
		"Where it writes",
		"What it asks for",
		"Each date as link",
		"Target periods",
		"Text around each link",
		"Path in each link",
		"Between several links",
		"What the link text says",
		"Date format of the link text",
	]);
	const [fields, , links] = page.items ?? [];
	assert.deepEqual(fields.items?.[1].control, { type: "dropdown", key: "commands/insert-dates/destination", options: { property: "A property", cursor: "At the cursor" } });
	const described = (name: string) => (links.items ?? []).find((item) => item.name === name)?.desc ?? "";
	assert.match(described("Text around each link"), /note body/);
	assert.match(described("Between several links"), /note body/);
});
