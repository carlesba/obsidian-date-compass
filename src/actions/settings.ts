import { t } from "../i18n/index.ts";
import { isRecord } from "../dateNotes/periods.ts";

export const ASK_KINDS = ["date", "dates"] as const;
export type AskKind = (typeof ASK_KINDS)[number];

export const ACTION_FIELDS = ["name", "enabled", "property", "asks", "link"] as const;
export type ActionField = (typeof ACTION_FIELDS)[number];

export interface DateAction {
	id: string;
	name: string;
	enabled: boolean;
	property: string;
	asks: AskKind;
	link: boolean;
}

export function presetActions(): DateAction[] {
	return [
		{ id: "set-dates", name: t("presetSetDates"), enabled: true, property: "dates", asks: "dates", link: true },
		{ id: "set-reminders", name: t("presetSetReminders"), enabled: true, property: "reminders", asks: "dates", link: true },
	];
}

const V1_PRESET_NAMES = ["Add dates", "Añadir fechas"];

export function mergeActions(stored: unknown): DateAction[] {
	if (!Array.isArray(stored)) return presetActions();
	const actions: DateAction[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		const action = isAskKind(entry.asks) ? mergeAction(entry, actions) : migratedAction(entry, actions);
		if (action) actions.push(action);
	}
	return actions;
}

function isAskKind(value: unknown): value is AskKind {
	return ASK_KINDS.some((kind) => kind === value);
}

function mergeAction(data: Record<string, unknown>, earlier: readonly DateAction[]): DateAction {
	return {
		id: uniqueId(data.id, earlier),
		name: text(data.name),
		enabled: typeof data.enabled === "boolean" ? data.enabled : true,
		property: text(data.property),
		asks: isAskKind(data.asks) ? data.asks : "dates",
		link: typeof data.link === "boolean" ? data.link : true,
	};
}

function migratedAction(data: Record<string, unknown>, earlier: readonly DateAction[]): DateAction | undefined {
	const inputs = records(data.inputs);
	const write = records(data.writes).find((candidate) => candidate.target !== "body" && text(candidate.property).trim() !== "");
	if (!write) return undefined;
	const question = inputs.find((input) => input.id === write.input);
	const name = text(data.name);
	return {
		id: uniqueId(data.id, earlier),
		name: V1_PRESET_NAMES.includes(name) ? t("presetSetDates") : name,
		enabled: typeof data.enabled === "boolean" ? data.enabled : true,
		property: text(write.property).trim(),
		asks: question?.type === "date" || question?.type === "periodicNote" ? "date" : "dates",
		link: write.format !== "dateText",
	};
}

function records(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function newAction(actions: readonly DateAction[], now: number = Date.now()): DateAction {
	return { id: freeId(actions, `action-${now.toString(36)}`), name: "", enabled: true, property: "", asks: "dates", link: true };
}

export function actionName(action: DateAction): string {
	return action.name.trim() === "" ? t("untitledAction") : action.name.trim();
}

export function actionWarning(action: DateAction): string | undefined {
	return action.property.trim() === "" ? t("actionNeedsProperty") : undefined;
}

export function questionOf(action: DateAction): string {
	return t(action.asks === "date" ? "actionAsksDate" : "actionAsksDates", { name: action.property.trim() });
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

function uniqueId(stored: unknown, earlier: readonly { id: string }[]): string {
	const id = typeof stored === "string" ? stored.trim() : "";
	if (id !== "" && !id.includes("/") && !earlier.some((entry) => entry.id === id)) return id;
	return freeId(earlier, "action");
}

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}
