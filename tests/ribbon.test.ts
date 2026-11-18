import { test } from "node:test";
import { strict as assert } from "node:assert";
import { cursorAndPropertyCommands, dateNotesEnabling, propertyCommand } from "./fixtures.ts";
import { PALETTE_COMMAND_ICON } from "../src/commands/palette.ts";
import { addRibbonCommand, availableRibbonCommands, canBeRibbonCommand, mergeRibbonButtons, moveRibbonCommand, removeRibbonCommand, ribbonButtons, ribbonCommandsToAdd, ribbonEntries } from "../src/ribbon/buttons.ts";
import type { RibbonButton, RibbonSource } from "../src/ribbon/buttons.ts";
import { RibbonButtons, arrangeInListOrder } from "../src/ribbon/sync.ts";
import type { RibbonHost } from "../src/ribbon/sync.ts";
import { ribbonButtonItems, ribbonEntryName, ribbonEntryWarning } from "../src/settings/ribbonList.ts";
import type { RibbonListContext } from "../src/settings/ribbonList.ts";
import { mergeSettings } from "../src/settings.ts";
import type { Period } from "../src/dateNotes/periods.ts";

function sourceWith(enabled: readonly Period[], commands = cursorAndPropertyCommands()): RibbonSource {
	return { dateNotes: dateNotesEnabling(enabled), commands };
}

const EVERY_PERIOD: readonly Period[] = ["day", "week", "month", "quarter", "year"];

test("a fresh install has no ribbon buttons, and a stored list is kept in its order", () => {
	assert.deepEqual(mergeSettings(undefined).ribbonButtons, []);
	assert.deepEqual(mergeSettings({ ribbonButtons: "open-today" }).ribbonButtons, []);
	assert.deepEqual(mergeSettings({ ribbonButtons: ["open-this-week", "open-today"] }).ribbonButtons, ["open-this-week", "open-today"]);
});

test("merging drops what is not text, repeats and ids that can never be a ribbon command", () => {
	assert.deepEqual(mergeRibbonButtons(["open-today", 3, null, "open-today", "open-calendar", "reveal-active-note-in-calendar", "nonsense", "command-", "command-a/b", "", "command-gone", "open-date-note-by-phrase"]), [
		"open-today",
		"command-gone",
		"open-date-note-by-phrase",
	]);
});

test("ids of turned-off periods and of commands that do not exist yet survive a merge", () => {
	const stored = { dateNotes: { periods: { week: { enabled: false } } }, commands: [], ribbonButtons: ["open-next-week", "command-set-dates"] };
	assert.deepEqual(mergeSettings(stored).ribbonButtons, ["open-next-week", "command-set-dates"]);
	assert.equal(canBeRibbonCommand("open-previous-date-note"), true);
	assert.equal(canBeRibbonCommand("open-calendar"), false);
});

test("only commands of enabled periods, the period-free ones and the palette commands are offered", () => {
	assert.deepEqual(availableRibbonCommands(sourceWith(["day", "month"])).map((command) => command.id), [
		"open-today",
		"open-this-month",
		"open-tomorrow",
		"open-next-month",
		"open-next-date-note",
		"open-previous-date-note",
		"open-date-note-by-phrase",
		"command-insert-dates",
		"command-set-dates",
		"command-set-reminders",
	]);
	assert.equal(availableRibbonCommands(sourceWith(EVERY_PERIOD, [])).length, 13);
	assert.deepEqual(availableRibbonCommands(sourceWith([], [])).map((command) => command.id), ["open-next-date-note", "open-previous-date-note", "open-date-note-by-phrase"]);
});

test("a command that still needs a property is not offered, and every offered command has a name and an icon", () => {
	const commands = [propertyCommand("ready", "Plan trip", "trip"), propertyCommand("unfinished", "Later", " ")];
	const offered = availableRibbonCommands(sourceWith(["day"], commands));
	assert.deepEqual(offered.slice(-1), [{ id: "command-ready", name: "Plan trip", icon: PALETTE_COMMAND_ICON }]);
	assert.deepEqual(offered[0], { id: "open-today", name: "Open today's note", icon: "calendar-check" });
	assert.equal(offered.every((command) => command.name !== "" && command.icon !== ""), true);
	assert.equal(new Set(availableRibbonCommands(sourceWith(EVERY_PERIOD, [])).map((command) => command.icon)).size, 13);
});

test("the picker leaves out the commands already in the list", () => {
	const source = sourceWith(["day"], []);
	assert.deepEqual(ribbonCommandsToAdd(["open-today", "open-date-note-by-phrase"], source).map((command) => command.id), ["open-tomorrow", "open-next-date-note", "open-previous-date-note"]);
	assert.deepEqual(ribbonCommandsToAdd(["open-today", "open-tomorrow", "open-next-date-note", "open-previous-date-note", "open-date-note-by-phrase", "open-this-week"], source), []);
});

test("a newly added command goes last, adding one twice changes nothing, and rows move and leave by position", () => {
	assert.deepEqual(addRibbonCommand(["open-today"], "open-tomorrow"), ["open-today", "open-tomorrow"]);
	assert.deepEqual(addRibbonCommand(["open-today", "open-tomorrow"], "open-today"), ["open-today", "open-tomorrow"]);
	assert.deepEqual(moveRibbonCommand(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
	assert.deepEqual(moveRibbonCommand(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
	assert.deepEqual(removeRibbonCommand(["a", "b", "c"], 1), ["a", "c"]);
	const listed = ["a", "b"];
	removeRibbonCommand(listed, 0);
	moveRibbonCommand(listed, 0, 1);
	assert.deepEqual(listed, ["a", "b"]);
});

test("a listed command that cannot run keeps its row with the reason, and gets no button", () => {
	const commands = [propertyCommand("ready", "Plan trip", "trip"), propertyCommand("unfinished", "Later", "")];
	const source = sourceWith(["day"], commands);
	const listed = ["open-this-week", "open-today", "command-gone", "command-unfinished", "command-ready"];
	const entries = ribbonEntries(listed, source);
	assert.deepEqual(entries.map((entry) => entry.problem?.kind), ["periodOff", undefined, "missing", "incomplete", undefined]);
	assert.deepEqual(entries.map(ribbonEntryName), ["Open this week's note", "Open today's note", "Deleted command", "Later", "Plan trip"]);
	assert.deepEqual(entries.map(ribbonEntryWarning), [
		"Weekly notes are turned off in Date notes, so this button is hidden until they are turned on there.",
		undefined,
		"This command no longer exists, so it has no button. Remove this row.",
		"This command is not in the command palette yet, so its button is hidden. Enter the property this command sets.",
		undefined,
	]);
	assert.deepEqual(ribbonButtons(listed, source), [
		{ commandId: "open-today", title: "Open today's note", icon: "calendar-check" },
		{ commandId: "command-ready", title: "Plan trip", icon: PALETTE_COMMAND_ICON },
	]);
});

test("turning the period back on brings the button back in its place", () => {
	const listed = ["open-this-week", "open-today"];
	assert.deepEqual(ribbonButtons(listed, sourceWith(["day", "week"])).map((button) => button.commandId), ["open-this-week", "open-today"]);
});

test("buttons whose names repeat, or match a tooltip already in the ribbon, get a numbered tooltip", () => {
	const commands = [propertyCommand("one", "Open calendar", "a"), propertyCommand("two", "Open calendar", "b"), propertyCommand("three", "Open today's note", "c")];
	const buttons = ribbonButtons(["command-one", "open-today", "command-two", "command-three"], sourceWith(["day"], commands), ["Open calendar"]);
	assert.deepEqual(buttons.map((button) => button.title), ["Open calendar (2)", "Open today's note", "Open calendar (3)", "Open today's note (2)"]);
});

function fakeRibbon(live = true): { host: RibbonHost; shown: string[]; log: string[] } {
	const shown: string[] = [];
	const log: string[] = [];
	const host: RibbonHost = {
		appliesLive: () => live,
		add: (button) => {
			shown.push(button.title);
			log.push(`add ${button.title}`);
		},
		remove: (button) => {
			shown.splice(shown.indexOf(button.title), 1);
			log.push(`remove ${button.title}`);
		},
		arrange: (buttons) => {
			log.push(`arrange ${buttons.map((button) => button.title).join(",")}`);
		},
		askForReload: () => {
			log.push("reload");
		},
	};
	return { host, shown, log };
}

function button(title: string, icon = "calendar"): RibbonButton {
	return { commandId: title.toLowerCase(), title, icon };
}

test("the ribbon is rebuilt in list order when the buttons change, and left alone when they do not", () => {
	const { host, shown, log } = fakeRibbon();
	const ribbon = new RibbonButtons(host);
	ribbon.sync([button("A"), button("B")]);
	assert.deepEqual(log, ["add A", "add B", "arrange A,B"]);
	ribbon.sync([button("A"), button("B")]);
	assert.equal(log.length, 3);
	ribbon.sync([button("B"), button("A")]);
	assert.deepEqual(log.slice(3), ["remove A", "remove B", "add B", "add A", "arrange B,A"]);
	ribbon.sync([button("B", "sun")]);
	assert.deepEqual(shown, ["B"]);
	ribbon.sync([]);
	assert.deepEqual(shown, []);
});

test("without a way to remove buttons, the first list is shown and later changes ask once for a reload", () => {
	const { host, shown, log } = fakeRibbon(false);
	const ribbon = new RibbonButtons(host);
	ribbon.sync([button("A")]);
	ribbon.sync([button("A"), button("B")]);
	ribbon.sync([button("A"), button("B")]);
	assert.deepEqual(shown, ["A"]);
	assert.deepEqual(log, ["add A", "arrange A", "reload"]);
	ribbon.sync([button("A")]);
	ribbon.sync([button("B")]);
	assert.deepEqual(log.slice(3), ["reload"]);
	assert.deepEqual(shown, ["A"]);
});

test("our ribbon items trade places among themselves and leave the other items where they are", () => {
	const items = ["x:1", "dc:B", "y:2", "dc:A", "dc:old", "dc:C"].map((id) => ({ id }));
	arrangeInListOrder(items, ["dc:A", "dc:B", "dc:C"]);
	assert.deepEqual(items.map((item) => item.id), ["x:1", "dc:A", "y:2", "dc:B", "dc:old", "dc:C"]);
	arrangeInListOrder(items, ["dc:C", "dc:missing"]);
	assert.deepEqual(items.map((item) => item.id), ["x:1", "dc:A", "y:2", "dc:B", "dc:old", "dc:C"]);
});

interface ListLike {
	type: string;
	heading?: string;
	visible?: () => boolean;
	items: { name: string; desc?: string }[];
	onReorder?: (from: number, to: number) => void;
	onDelete?: (position: number) => void;
	addItem?: { action: (anchor: HTMLElement) => void };
}

function listContext(listed: string[], source: RibbonSource, live = true) {
	const changes: string[][] = [];
	const notices: string[] = [];
	const offered: string[][] = [];
	let picked: string | undefined;
	const context: RibbonListContext = {
		listed: () => listed,
		source: () => source,
		appliesLive: () => live,
		change: (next) => void changes.push(next),
		choose: (_anchor, choices, pick) => {
			offered.push(choices.map((choice) => choice.name));
			if (picked) pick(picked);
		},
		notify: (message) => void notices.push(message),
	};
	const [reloadNote, list] = ribbonButtonItems(context) as unknown as [ListLike, ListLike];
	return { changes, notices, offered, reloadNote, list, pick: (id: string) => void (picked = id) };
}

test("the Ribbon buttons list shows one row per entry, with the warning of those that cannot run", () => {
	const { list, reloadNote } = listContext(["open-today", "open-this-quarter"], sourceWith(["day"], []));
	assert.equal(list.type, "list");
	assert.equal(list.heading, "Ribbon buttons");
	assert.deepEqual(list.items.map((item) => [item.name, item.desc]), [
		["Open today's note", undefined],
		["Open this quarter's note", "Quarterly notes are turned off in Date notes, so this button is hidden until they are turned on there."],
	]);
	assert.equal(reloadNote.visible?.(), false);
	assert.equal(listContext([], sourceWith(["day"], []), false).reloadNote.visible?.(), true);
});

test("+ always opens the picker of the commands left, and says so when none is left", () => {
	const source = sourceWith([], []);
	const some = listContext(["open-next-date-note", "open-previous-date-note"], source);
	some.pick("open-date-note-by-phrase");
	some.list.addItem?.action({} as HTMLElement);
	assert.deepEqual(some.offered, [["Open a date note by phrase"]]);
	assert.deepEqual(some.changes, [["open-next-date-note", "open-previous-date-note", "open-date-note-by-phrase"]]);
	const none = listContext(["open-next-date-note", "open-previous-date-note", "open-date-note-by-phrase"], source);
	none.list.addItem?.action({} as HTMLElement);
	assert.deepEqual(none.offered, []);
	assert.deepEqual(none.notices, ["Every available command already has a ribbon button."]);
});

test("dragging and the remove button of the list change the stored order", () => {
	const { list, changes } = listContext(["open-today", "command-gone", "open-tomorrow"], sourceWith(["day"], []));
	list.onReorder?.(2, 0);
	list.onDelete?.(1);
	assert.deepEqual(changes, [
		["open-tomorrow", "open-today", "command-gone"],
		["open-today", "open-tomorrow"],
	]);
});
