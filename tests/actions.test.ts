import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { Command } from "obsidian";
import { moment } from "./moment.ts";
import { defaultDateNotes } from "../src/dateNotes/periods.ts";
import type { ParseOptions } from "../src/parse/index.ts";
import type { NoteRef } from "../src/mentions/rows.ts";
import { currentNoteRows } from "../src/mentions/rows.ts";
import { previewSequence } from "../src/sequence/preview.ts";
import type { CursorEditor, SequenceContext } from "../src/sequence/preview.ts";
import { mergeSequence } from "../src/sequence/settings.ts";
import { mergeActions, newAction, newInput, newWrite, presetActions, writeWarning } from "../src/actions/settings.ts";
import type { DateAction, PropertyMode } from "../src/actions/settings.ts";
import { dateSortKey, linkTarget, mergedProperty } from "../src/actions/frontmatter.ts";
import { plannedWrites, runAction } from "../src/actions/run.ts";
import type { ActionContext, ActionHost, Answer } from "../src/actions/run.ts";
import { ActionCommands, actionCommands } from "../src/actions/commands.ts";
import { actionsPage, answerOptions, conditionOptions } from "../src/settings/actionsPage.ts";
import { actionKey, inputKey, readControl, writeControl, writeKey } from "../src/settings/controlKeys.ts";
import { defaultSettings, mergeSettings } from "../src/settings.ts";

const now = moment("2026-11-17 12:00", "YYYY-MM-DD HH:mm");

const options: ParseOptions = { languages: ["en"], weekStart: "monday", nextWeekday: "nextWeek", dayMonthOrder: "dayMonth" };

const periods = defaultDateNotes().periods;

function rowContext(): SequenceContext {
	return { now, moment, options, periods, allows: () => true };
}

function notesOf(phrase: string): NoteRef[] {
	const preview = previewSequence(phrase, rowContext());
	assert.equal(preview.kind, "dates", phrase);
	return preview.kind === "dates" ? preview.notes : [];
}

const linkTo = (note: NoteRef) => `[[${note.name}]]`;

const sortKeyOf = dateSortKey(periods, moment);

test("an older settings object without actions gets the two presets exactly as the spec lists them", () => {
	const loaded = mergeSettings({ weekStart: "monday", insertSequence: { layout: "bulletList" } });
	assert.deepEqual(loaded.actions, [
		{
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
		},
		{
			id: "set-reminders",
			name: "Set reminders",
			enabled: true,
			inputs: [{ id: "reminders", key: "reminders", question: "Reminders", type: "dates", optional: false, defaultText: "" }],
			writes: [{ id: "reminders", target: "property", property: "reminders", input: "reminders", value: "links", format: "link", mode: "append", condition: "" }],
		},
	]);
	assert.deepEqual(defaultSettings().actions, presetActions());
});

test("saved actions are kept and removed presets are not added back", () => {
	const settings = defaultSettings();
	settings.actions.splice(0, 1);
	settings.actions[0].name = "Remind me";
	const reloaded = mergeSettings(JSON.parse(JSON.stringify(settings)));
	assert.deepEqual(reloaded.actions, settings.actions);
	assert.deepEqual(mergeSettings({ actions: [] }).actions, []);
});

test("stored actions merge field by field and get unique ids", () => {
	const [merged, second] = mergeActions([
		{ id: "a", name: "Log", inputs: [{ key: "when", type: "calendar" }, "broken"], writes: [{ property: "log", mode: "merge", condition: 3 }] },
		{ id: "a" },
		"broken",
	]);
	assert.deepEqual(merged, {
		id: "a",
		name: "Log",
		enabled: true,
		inputs: [{ id: "input-1", key: "when", question: "", type: "dates", optional: false, defaultText: "" }],
		writes: [{ id: "write-1", target: "property", property: "log", input: "", value: "links", format: "link", mode: "dedupeSort", condition: "" }],
	});
	assert.equal(second.id, "action-1");
});

test("a new write defaults to links of the first dates question, as a link, deduped and sorted, always", () => {
	const action = newAction([]);
	action.inputs.push({ ...newInput(action.inputs), type: "yesNo" }, newInput([{ ...newInput([]) }]));
	assert.deepEqual(newWrite([], action.inputs), { id: "write-1", target: "property", property: "", input: "input-2", value: "links", format: "link", mode: "dedupeSort", condition: "" });
});

const MODES: PropertyMode[] = ["append", "dedupeSort", "replace"];

test("every mode on a missing property writes the new values", () => {
	for (const mode of MODES) {
		assert.deepEqual(mergedProperty(undefined, ["[[2026-11-18]]", "[[2026-11-17]]"], mode, sortKeyOf), mode === "dedupeSort" ? ["[[2026-11-17]]", "[[2026-11-18]]"] : ["[[2026-11-18]]", "[[2026-11-17]]"], mode);
		assert.deepEqual(mergedProperty(null, ["[[2026-11-18]]"], mode, sortKeyOf), mode === "replace" ? "[[2026-11-18]]" : ["[[2026-11-18]]"], mode);
	}
	assert.deepEqual(mergedProperty("", ["2026-11-18"], "append", sortKeyOf), ["2026-11-18"]);
});

test("a scalar existing value becomes a one-item list before appending", () => {
	assert.deepEqual(mergedProperty("[[2026-11-20]]", ["[[2026-11-18]]"], "append", sortKeyOf), ["[[2026-11-20]]", "[[2026-11-18]]"]);
	assert.deepEqual(mergedProperty("[[2026-11-20]]", ["[[2026-11-18]]", "[[2026-11-20]]"], "dedupeSort", sortKeyOf), ["[[2026-11-18]]", "[[2026-11-20]]"]);
	assert.deepEqual(mergedProperty("2026-11-20", ["2026-11-18"], "replace", sortKeyOf), "2026-11-18");
});

test("a list existing value is appended to, deduped and sorted by date, or replaced", () => {
	const existing = ["[[2026-12-01]]", "someday", "[[2026-11-18]]"];
	const values = ["[[2026-11-18]]", "[[2026-W48]]", "[[2026-11-17]]"];
	assert.deepEqual(mergedProperty(existing, values, "append", sortKeyOf), [...existing, ...values]);
	assert.deepEqual(mergedProperty(existing, values, "dedupeSort", sortKeyOf), ["[[2026-11-17]]", "[[2026-11-18]]", "[[2026-W48]]", "[[2026-12-01]]", "someday"]);
	assert.deepEqual(mergedProperty(existing, values, "replace", sortKeyOf), values);
	assert.deepEqual(existing, ["[[2026-12-01]]", "someday", "[[2026-11-18]]"]);
});

test("dedupe and sort reads dates from wikilinks, markdown links, paths and plain text", () => {
	const items = ["[Dec](journal/2026-12-01.md)", "[[journal/2026-11-30|Mon]]", "2026-11-29", "[[2026-11]]", "notes"];
	assert.deepEqual(mergedProperty(items, [], "dedupeSort", sortKeyOf), ["[[2026-11]]", "2026-11-29", "[[journal/2026-11-30|Mon]]", "[Dec](journal/2026-12-01.md)", "notes"]);
	assert.equal(linkTarget("[Wed](<2026 11 18.md>)"), "2026 11 18.md");
	assert.equal(linkTarget("[[2026-11-18#Tasks|Wed]]"), "2026-11-18");
});

function addDates(): DateAction {
	return presetActions()[0];
}

test("links, first and last pick the dates of an answer, written as links or as date text", () => {
	const action = addDates();
	const answers = new Map<string, Answer>([
		["dates", { kind: "notes", notes: notesOf("mon to wed") }],
		["update-start-and-end", { kind: "yesNo", yes: true }],
	]);
	assert.deepEqual(plannedWrites(action, answers, linkTo).properties, [
		{ property: "dates", values: ["[[2026-11-23]]", "[[2026-11-24]]", "[[2026-11-25]]"], mode: "append" },
		{ property: "start", values: ["2026-11-23"], mode: "replace" },
		{ property: "end", values: ["2026-11-25"], mode: "replace" },
	]);
	for (const write of action.writes) write.format = write.format === "link" ? "dateText" : "link";
	assert.deepEqual(
		plannedWrites(action, answers, linkTo).properties.map((write) => write.values),
		[["2026-11-23", "2026-11-24", "2026-11-25"], ["[[2026-11-23]]"], ["[[2026-11-25]]"]],
	);
	const weeks = new Map<string, Answer>([...answers, ["dates", { kind: "notes", notes: notesOf("W48 to W50") }]]);
	assert.deepEqual(plannedWrites(action, weeks, linkTo).properties.map((write) => write.values), [["2026-W48", "2026-W49", "2026-W50"], ["[[2026-W48]]"], ["[[2026-W50]]"]]);
});

interface FakeHost extends ActionHost {
	asked: string[];
	frontmatter: Record<string, unknown>;
	frontmatterWrites: number;
}

function fakeHost(answers: Record<string, Answer | undefined>, frontmatter: Record<string, unknown> = {}): FakeHost {
	const host: FakeHost = {
		asked: [],
		frontmatter,
		frontmatterWrites: 0,
		ask: (input) => {
			host.asked.push(input.question);
			return Promise.resolve(answers[input.key]);
		},
		linkTo,
		processFrontMatter: (change) => {
			host.frontmatterWrites++;
			change(host.frontmatter);
			return Promise.resolve();
		},
		notify: () => undefined,
	};
	return host;
}

function fakeEditor(line: string): CursorEditor & { inserted: string[] } {
	const inserted: string[] = [];
	return { inserted, getCursor: () => ({ line: 0, ch: line.length }), getLine: () => line, replaceSelection: (text: string) => void inserted.push(text) };
}

function actionContext(editor?: CursorEditor): ActionContext {
	return { periods, moment, insertSequence: mergeSequence(undefined), separator: "commaSpace", editor };
}

test("Add dates asks Dates then Update start and end, and writes dates, start and end, promoting a scalar", async () => {
	const host = fakeHost(
		{ dates: { kind: "notes", notes: notesOf("today to fri") }, updateStartAndEnd: { kind: "yesNo", yes: true } },
		{ dates: "[[2026-11-10]]", title: "Trip" },
	);
	assert.equal(await runAction(addDates(), host, actionContext()), "written");
	assert.deepEqual(host.asked, ["Dates", "Update start and end?"]);
	assert.equal(host.frontmatterWrites, 1);
	assert.deepEqual(host.frontmatter, {
		dates: ["[[2026-11-10]]", "[[2026-11-17]]", "[[2026-11-18]]", "[[2026-11-19]]", "[[2026-11-20]]"],
		title: "Trip",
		start: "2026-11-17",
		end: "2026-11-20",
	});
});

test("a write whose condition is a yes/no answered no is skipped", async () => {
	const host = fakeHost({ dates: { kind: "notes", notes: notesOf("mon to wed") }, updateStartAndEnd: { kind: "yesNo", yes: false } }, { start: "2026-01-01" });
	await runAction(addDates(), host, actionContext());
	assert.deepEqual(host.frontmatter, { start: "2026-01-01", dates: ["[[2026-11-23]]", "[[2026-11-24]]", "[[2026-11-25]]"] });
	const skipped = fakeHost({ dates: { kind: "notes", notes: notesOf("mon to wed") }, updateStartAndEnd: { kind: "skipped" } });
	await runAction(addDates(), skipped, actionContext());
	assert.deepEqual(Object.keys(skipped.frontmatter), ["dates"]);
});

test("Set reminders appends every date of the sequence to reminders", async () => {
	const host = fakeHost({ reminders: { kind: "notes", notes: notesOf("every mon, wed for 2 weeks") } }, { reminders: ["[[2026-11-01]]"] });
	await runAction(presetActions()[1], host, actionContext());
	assert.deepEqual(host.frontmatter.reminders, ["[[2026-11-01]]", "[[2026-11-18]]", "[[2026-11-23]]", "[[2026-11-25]]", "[[2026-11-30]]"]);
});

test("cancelling a question writes nothing, and an unanswered optional question writes nothing", async () => {
	const cancelled = fakeHost({ dates: undefined });
	assert.equal(await runAction(addDates(), cancelled, actionContext()), "cancelled");
	assert.deepEqual(cancelled.asked, ["Dates"]);
	assert.equal(cancelled.frontmatterWrites, 0);
	const skipped = fakeHost({ reminders: { kind: "skipped" } });
	assert.equal(await runAction(presetActions()[1], skipped, actionContext()), "nothingToWrite");
	assert.equal(skipped.frontmatterWrites, 0);
});

test("a body write inserts at the cursor in the Insert sequence layout", async () => {
	const action = presetActions()[1];
	action.writes = [{ ...action.writes[0], target: "body", value: "links" }, { ...action.writes[0], id: "w2", target: "body", value: "last", format: "dateText" }];
	const editor = fakeEditor("Due ");
	const host = fakeHost({ reminders: { kind: "notes", notes: notesOf("mon to wed") } });
	assert.equal(await runAction(action, host, actionContext(editor)), "written");
	assert.equal(host.frontmatterWrites, 0);
	assert.deepEqual(editor.inserted, ["[[2026-11-23]], [[2026-11-24]], [[2026-11-25]]", "2026-11-25"]);
	assert.equal(await runAction(action, fakeHost({ reminders: { kind: "notes", notes: notesOf("mon") } }), actionContext()), "noEditor");
});

test("a write with no property, a missing question or a condition on a non yes/no question is flagged and skipped", () => {
	const action = addDates();
	action.writes[0].property = " ";
	action.writes[1].input = "update-start-and-end";
	action.writes[2].condition = "dates";
	assert.equal(writeWarning(action, action.writes[0]), "Enter the property this write fills in.");
	assert.equal(writeWarning(action, action.writes[1]), "Choose a question that asks for dates.");
	assert.equal(writeWarning(action, action.writes[2]), "The condition needs a yes-or-no question.");
	const answers = new Map<string, Answer>([["dates", { kind: "notes", notes: notesOf("mon") }], ["update-start-and-end", { kind: "yesNo", yes: true }]]);
	assert.deepEqual(plannedWrites(action, answers, linkTo), { properties: [], body: [] });
	assert.deepEqual(answerOptions(action, action.writes[1]), { "update-start-and-end": "Choose a question", dates: "dates" });
	assert.deepEqual(conditionOptions(action, action.writes[2]), { "": "Always", dates: "A question that no longer asks yes or no", "update-start-and-end": "updateStartAndEnd is answered yes" });
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
	assert.deepEqual([...commands], [["action-add-dates", "Add dates"], ["action-set-reminders", "Set reminders"]]);
	actions[1].enabled = false;
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-add-dates", "Add dates"]]);
	actions[1].enabled = true;
	actions[0].name = "Plan trip";
	registry.sync(actions);
	assert.deepEqual([...commands].sort(), [["action-add-dates", "Plan trip"], ["action-set-reminders", "Set reminders"]]);
	actions.splice(0, 1);
	registry.sync(actions);
	assert.deepEqual([...commands], [["action-set-reminders", "Set reminders"]]);
	assert.deepEqual(actionCommands([{ ...newAction([]), name: "  " }]).map((command) => command.name), ["Untitled action"]);
});

function controlKeysOf(items: readonly unknown[]): string[] {
	return items.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const record = item as { control?: { key: string }; items?: unknown[] };
		return [...(record.control ? [record.control.key] : []), ...controlKeysOf(record.items ?? [])];
	});
}

test("the Actions subpage reads and writes every control through controlKeys", () => {
	const settings = defaultSettings();
	const page = actionsPage({ actions: () => settings.actions, write: () => undefined, openPage: () => undefined, change: (mutate) => void mutate() });
	const keys = controlKeysOf(page.items ?? []);
	assert.deepEqual(keys.slice(0, 7), [
		actionKey("add-dates", "enabled"),
		actionKey("add-dates", "name"),
		inputKey("add-dates", "dates", "key"),
		inputKey("add-dates", "dates", "question"),
		inputKey("add-dates", "dates", "type"),
		inputKey("add-dates", "dates", "optional"),
		inputKey("add-dates", "dates", "defaultText"),
	]);
	assert.ok(keys.includes(writeKey("set-reminders", "reminders", "condition")));
	for (const key of keys) {
		const value = readControl(settings, key);
		assert.notEqual(value, undefined, key);
		assert.equal(writeControl(settings, key, value), true, key);
	}
	assert.equal(writeControl(settings, actionKey("set-reminders", "enabled"), false), true);
	assert.equal(writeControl(settings, inputKey("add-dates", "dates", "type"), "periodicNote"), true);
	assert.equal(writeControl(settings, inputKey("add-dates", "dates", "type"), "calendar"), false);
	assert.equal(writeControl(settings, writeKey("add-dates", "dates", "mode"), "replace"), true);
	assert.equal(writeControl(settings, writeKey("add-dates", "dates", "mode"), "merge"), false);
	assert.equal(writeControl(settings, writeKey("add-dates", "start", "property"), "begins"), true);
	assert.equal(writeControl(settings, writeKey("add-dates", "nope", "property"), "x"), false);
	assert.equal(writeControl(settings, actionKey("add-dates", "enabled"), "yes"), false);
	assert.equal(settings.actions[1].enabled, false);
	assert.equal(settings.actions[0].inputs[0].type, "periodicNote");
	assert.equal(settings.actions[0].writes[0].mode, "replace");
	assert.equal(settings.actions[0].writes[1].property, "begins");
});

test("the Actions subpage adds, reorders and removes actions, questions and writes", () => {
	const settings = defaultSettings();
	const opened: string[] = [];
	const context = { actions: () => settings.actions, write: () => undefined, openPage: (id: string) => void opened.push(id), change: (mutate: () => unknown) => void mutate() };
	type ListLike = { onReorder?: (a: number, b: number) => void; onDelete?: (index: number) => void; addItem?: { action: (el: HTMLElement) => void }; items?: unknown[] };
	const [actionsList, hidden] = (actionsPage(context).items ?? []) as unknown as [ListLike, { items: { items: ListLike[] }[] }];
	actionsList.onReorder?.(0, 1);
	assert.deepEqual(settings.actions.map((action) => action.id), ["set-reminders", "add-dates"]);
	actionsList.addItem?.action({} as HTMLElement);
	assert.deepEqual(opened, ["action-action-1"]);
	actionsList.onDelete?.(2);
	assert.deepEqual(settings.actions.map((action) => action.id), ["set-reminders", "add-dates"]);
	const [, questions, writes] = hidden.items[0].items;
	questions.addItem?.action({} as HTMLElement);
	writes.onDelete?.(0);
	const addDates = settings.actions[1];
	assert.deepEqual(addDates.inputs.map((input) => input.id), ["dates", "update-start-and-end", "input-1"]);
	assert.deepEqual(addDates.writes.map((write) => write.id), ["start", "end"]);
	assert.deepEqual(opened, ["action-action-1", "action-add-dates-input-input-1"]);
});

test("a periodic note question with no text offers the current note of each enabled period", () => {
	const rows = currentNoteRows({ now, moment, options, periods, allows: () => true });
	assert.deepEqual(rows.map((row) => row.notes[0].name), ["2026-11-17", "2026-W47", "2026-11", "2026"]);
	const withQuarters = { ...defaultDateNotes().periods, quarter: { ...periods.quarter, enabled: true } };
	const sunday = currentNoteRows({ now: moment("2026-11-22 09:00", "YYYY-MM-DD HH:mm"), moment, options: { ...options, weekStart: "sunday" }, periods: withQuarters, allows: (period) => period !== "day" });
	assert.deepEqual(sunday.map((row) => row.notes[0].name), ["2026-W48", "2026-11", "2026-Q4", "2026"]);
});
