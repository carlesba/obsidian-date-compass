import { t } from "../i18n/index.ts";
import { isRecord } from "../dateNotes/periods.ts";

export const INPUT_TYPES = ["date", "dates", "periodicNote", "yesNo"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const WRITE_TARGETS = ["property", "body"] as const;
export type WriteTarget = (typeof WRITE_TARGETS)[number];

export const WRITE_VALUES = ["links", "first", "last"] as const;
export type WriteValue = (typeof WRITE_VALUES)[number];

export const VALUE_FORMATS = ["link", "dateText"] as const;
export type ValueFormat = (typeof VALUE_FORMATS)[number];

export const PROPERTY_MODES = ["append", "dedupeSort", "replace"] as const;
export type PropertyMode = (typeof PROPERTY_MODES)[number];

export const INPUT_FIELDS = ["key", "question", "type", "optional", "defaultText"] as const;
export type InputField = (typeof INPUT_FIELDS)[number];

export const WRITE_FIELDS = ["target", "property", "input", "value", "format", "mode", "condition"] as const;
export type WriteField = (typeof WRITE_FIELDS)[number];

export const ACTION_FIELDS = ["name", "enabled"] as const;
export type ActionField = (typeof ACTION_FIELDS)[number];

export interface ActionInput {
	id: string;
	key: string;
	question: string;
	type: InputType;
	optional: boolean;
	defaultText: string;
}

export interface ActionWrite {
	id: string;
	target: WriteTarget;
	property: string;
	input: string;
	value: WriteValue;
	format: ValueFormat;
	mode: PropertyMode;
	condition: string;
}

export interface DateAction {
	id: string;
	name: string;
	enabled: boolean;
	inputs: ActionInput[];
	writes: ActionWrite[];
}

export const ALWAYS = "";

export function presetActions(): DateAction[] {
	return [
		{
			id: "add-dates",
			name: t("presetAddDates"),
			enabled: true,
			inputs: [
				{ id: "dates", key: "dates", question: t("presetDatesQuestion"), type: "dates", optional: false, defaultText: "" },
				{ id: "update-start-and-end", key: "updateStartAndEnd", question: t("presetUpdateStartAndEndQuestion"), type: "yesNo", optional: false, defaultText: "" },
			],
			writes: [
				{ id: "dates", target: "property", property: "dates", input: "dates", value: "links", format: "link", mode: "append", condition: ALWAYS },
				{ id: "start", target: "property", property: "start", input: "dates", value: "first", format: "dateText", mode: "replace", condition: "update-start-and-end" },
				{ id: "end", target: "property", property: "end", input: "dates", value: "last", format: "dateText", mode: "replace", condition: "update-start-and-end" },
			],
		},
		{
			id: "set-reminders",
			name: t("presetSetReminders"),
			enabled: true,
			inputs: [{ id: "reminders", key: "reminders", question: t("presetRemindersQuestion"), type: "dates", optional: false, defaultText: "" }],
			writes: [{ id: "reminders", target: "property", property: "reminders", input: "reminders", value: "links", format: "link", mode: "append", condition: ALWAYS }],
		},
	];
}

export function mergeActions(stored: unknown): DateAction[] {
	if (!Array.isArray(stored)) return presetActions();
	const actions: DateAction[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		actions.push(mergeAction(entry, actions));
	}
	return actions;
}

function mergeAction(data: Record<string, unknown>, earlier: readonly DateAction[]): DateAction {
	const inputs: ActionInput[] = [];
	for (const entry of Array.isArray(data.inputs) ? data.inputs : []) if (isRecord(entry)) inputs.push(mergeInput(entry, inputs));
	const writes: ActionWrite[] = [];
	for (const entry of Array.isArray(data.writes) ? data.writes : []) if (isRecord(entry)) writes.push(mergeWrite(entry, writes));
	return {
		id: uniqueId(data.id, earlier, "action"),
		name: text(data.name),
		enabled: typeof data.enabled === "boolean" ? data.enabled : true,
		inputs,
		writes,
	};
}

function mergeInput(data: Record<string, unknown>, earlier: readonly ActionInput[]): ActionInput {
	const fallback = newInput(earlier);
	return {
		id: uniqueId(data.id, earlier, "input"),
		key: text(data.key, fallback.key),
		question: text(data.question),
		type: oneOf(INPUT_TYPES, data.type, fallback.type),
		optional: typeof data.optional === "boolean" ? data.optional : fallback.optional,
		defaultText: text(data.defaultText),
	};
}

function mergeWrite(data: Record<string, unknown>, earlier: readonly ActionWrite[]): ActionWrite {
	const fallback = newWrite(earlier, []);
	return {
		id: uniqueId(data.id, earlier, "write"),
		target: oneOf(WRITE_TARGETS, data.target, fallback.target),
		property: text(data.property),
		input: text(data.input),
		value: oneOf(WRITE_VALUES, data.value, fallback.value),
		format: oneOf(VALUE_FORMATS, data.format, fallback.format),
		mode: oneOf(PROPERTY_MODES, data.mode, fallback.mode),
		condition: text(data.condition),
	};
}

export function newAction(actions: readonly DateAction[]): DateAction {
	return { id: freeId(actions, "action"), name: "", enabled: true, inputs: [], writes: [] };
}

export function newInput(inputs: readonly ActionInput[]): ActionInput {
	const id = freeId(inputs, "input");
	return { id, key: id, question: "", type: "dates", optional: false, defaultText: "" };
}

export function newWrite(writes: readonly ActionWrite[], inputs: readonly ActionInput[]): ActionWrite {
	const input = inputs.find((candidate) => asksForNotes(candidate));
	return { id: freeId(writes, "write"), target: "property", property: "", input: input?.id ?? "", value: "links", format: "link", mode: "dedupeSort", condition: ALWAYS };
}

export function asksForNotes(input: ActionInput): boolean {
	return input.type !== "yesNo";
}

export function inputOf(action: DateAction, id: string): ActionInput | undefined {
	return action.inputs.find((input) => input.id === id);
}

export function actionName(action: DateAction): string {
	return action.name.trim() === "" ? t("untitledAction") : action.name.trim();
}

export function inputName(input: ActionInput): string {
	return input.key.trim() === "" ? t("untitledInput") : input.key.trim();
}

export function writeWarning(action: DateAction, write: ActionWrite): string | undefined {
	if (write.target === "property" && write.property.trim() === "") return t("writeNeedsProperty");
	const input = inputOf(action, write.input);
	if (!input || !asksForNotes(input)) return t("writeNeedsDatesInput");
	if (write.condition !== ALWAYS && inputOf(action, write.condition)?.type !== "yesNo") return t("writeNeedsYesNoInput");
	return undefined;
}

export function actionWarning(action: DateAction): string | undefined {
	if (action.writes.length === 0) return t("actionWritesNothing");
	return action.writes.some((write) => writeWarning(action, write)) ? t("actionHasBrokenWrites") : undefined;
}

export function moveEntry(entries: unknown[], from: number, to: number): void {
	entries.splice(to, 0, ...entries.splice(from, 1));
}

function freeId(entries: readonly { id: string }[], prefix: string): string {
	for (let number = 1; ; number++) {
		const id = `${prefix}-${number}`;
		if (!entries.some((entry) => entry.id === id)) return id;
	}
}

function uniqueId(stored: unknown, earlier: readonly { id: string }[], prefix: string): string {
	const id = typeof stored === "string" ? stored.trim() : "";
	if (id !== "" && !id.includes("/") && !earlier.some((entry) => entry.id === id)) return id;
	return freeId(earlier, prefix);
}

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function oneOf<Choice extends string>(choices: readonly Choice[], stored: unknown, fallback: Choice): Choice {
	return choices.find((choice) => choice === stored) ?? fallback;
}
