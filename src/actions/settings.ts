import { t } from "../i18n/index.ts";
import { isRecord } from "../dateNotes/periods.ts";
import { defaultLinkStyle, mergeLinkStyle } from "../insertion/linkStyle.ts";
import type { LinkStyle } from "../insertion/linkStyle.ts";
import { freeId, uniqueId } from "../settings/entryList.ts";

export const ASK_KINDS = ["date", "dates"] as const;
export type AskKind = (typeof ASK_KINDS)[number];

export const WRITE_MODES = ["add", "replace"] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

const ACTION_ID_PREFIX = "action";

export const ACTION_FIELDS = ["name", "property", "mode", "asks", "link"] as const;
export type ActionField = (typeof ACTION_FIELDS)[number];

export interface DateAction extends LinkStyle {
	id: string;
	name: string;
	property: string;
	mode: WriteMode;
	asks: AskKind;
	link: boolean;
}

export function presetActions(): DateAction[] {
	return [
		{ ...defaultLinkStyle(), id: "set-dates", name: t("presetAddDates"), property: "dates", mode: "add", asks: "dates", link: true },
		{ ...defaultLinkStyle(), id: "set-reminders", name: t("presetSetReminders"), property: "reminders", mode: "add", asks: "dates", link: true },
	];
}

function isWriteMode(value: unknown): value is WriteMode {
	return WRITE_MODES.some((mode) => mode === value);
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

function isAskKind(value: unknown): value is AskKind {
	return ASK_KINDS.some((kind) => kind === value);
}

function mergeAction(data: Record<string, unknown>, earlier: readonly DateAction[]): DateAction {
	return {
		...mergeLinkStyle(data),
		id: uniqueId(data.id, earlier, ACTION_ID_PREFIX),
		name: text(data.name),
		property: text(data.property),
		mode: isWriteMode(data.mode) ? data.mode : "add",
		asks: isAskKind(data.asks) ? data.asks : "dates",
		link: typeof data.link === "boolean" ? data.link : true,
	};
}

export function newAction(actions: readonly DateAction[], now: number = Date.now()): DateAction {
	return { ...defaultLinkStyle(), id: freeId(actions, `${ACTION_ID_PREFIX}-${now.toString(36)}`), name: "", property: "", mode: "add", asks: "dates", link: true };
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

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}
