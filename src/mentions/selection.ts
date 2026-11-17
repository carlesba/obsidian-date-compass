import type { DateRow } from "./rows.ts";

export interface MoreRow {
	source: "more";
}

export type Suggestion = DateRow | MoreRow;

export type SelectionIntent = "insert" | "insertFlippingAlias" | "openDatesModal";

export const MORE_ROW: MoreRow = { source: "more" };

export function withMoreRow(rows: readonly DateRow[]): Suggestion[] {
	return [...rows, MORE_ROW];
}

export function isMoreRow(suggestion: Suggestion): suggestion is MoreRow {
	return suggestion.source === "more";
}

export function selectionIntent(suggestion: Suggestion, keys: { altKey: boolean; shiftKey: boolean }): SelectionIntent {
	if (isMoreRow(suggestion) || keys.shiftKey) return "openDatesModal";
	return keys.altKey ? "insertFlippingAlias" : "insert";
}
