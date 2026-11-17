import type { Moment } from "moment";
import type { Editor } from "obsidian";
import { t } from "../i18n/index.ts";
import { parseWithRefusals } from "../parse/index.ts";
import type { Analysis, ParseOptions } from "../parse/index.ts";
import { PHRASE_PARSER, bulletLinesText, buildRows, indentOf, insertionText, isListMarkerOnly, noteCount, rangeDescription, rowLabel } from "../mentions/rows.ts";
import type { DateRow, NoteRef, RowContext } from "../mentions/rows.ts";
import type { LinkSeparator } from "../mentions/settings.ts";
import { LINK_PLACEHOLDER } from "./settings.ts";
import type { SequenceSettings } from "./settings.ts";

export type Analyzer = (text: string, now: Date, options: ParseOptions) => Analysis;

export interface SequenceContext extends RowContext {
	analyze?: Analyzer;
}

export type SequencePreview = { kind: "empty" } | { kind: "dates"; notes: NoteRef[]; text: string } | { kind: "invalid"; text: string };

export function previewSequence(query: string, context: SequenceContext): SequencePreview {
	const text = query.trim();
	if (text === "") return { kind: "empty" };
	const row = buildRows(text, context).find((candidate) => candidate.source === "interpretation");
	if (row) return { kind: "dates", notes: row.notes, text: previewLabel(row, context.now) };
	return { kind: "invalid", text: invalidReason(text, context) };
}

function previewLabel(row: DateRow, now: Moment): string {
	if (row.notes.length === 1) return rowLabel(row, now);
	return `${noteCount(row.notes)} · ${rangeDescription(row.notes, now, " – ")}`;
}

function invalidReason(text: string, context: SequenceContext): string {
	const now = context.now.toDate();
	const { interpretations, refusals } = (context.analyze ?? parseWithRefusals)(text, now, context.options);
	const [refusal] = refusals;
	if (refusal) return t("sequenceTooLong", { limit: refusal.limit });
	if (interpretations.length > 0) return t("sequencePeriodOff");
	const [completion] = (context.parser ?? PHRASE_PARSER).complete(text, now, context.options);
	if (completion) return t("sequenceKeepTyping", { phrase: completion.text });
	return t("sequenceNotADate");
}

export function sequenceInsertion(links: readonly string[], sequence: SequenceSettings, separator: LinkSeparator, textBeforeCursor: string): string {
	const items = links.map((link) => sequence.itemTemplate.split(LINK_PLACEHOLDER).join(link));
	switch (sequence.layout) {
		case "inline":
			return insertionText(items, separator, textBeforeCursor);
		case "bulletList":
			return bulletLinesText(items, textBeforeCursor);
		case "linePerItem":
			return linesText(items, textBeforeCursor);
	}
}

function linesText(items: readonly string[], textBeforeCursor: string): string {
	const indent = indentOf(textBeforeCursor);
	const continuesLine = textBeforeCursor.trim() === "" || isListMarkerOnly(textBeforeCursor);
	const lines = items.join(`\n${indent}`);
	return continuesLine ? lines : `\n${indent}${lines}`;
}

export type CursorEditor = Pick<Editor, "getCursor" | "getLine" | "replaceSelection">;

export function insertAtCursor(
	editor: CursorEditor,
	preview: SequencePreview,
	linkTo: (note: NoteRef) => string,
	sequence: SequenceSettings,
	separator: LinkSeparator,
): boolean {
	if (preview.kind !== "dates") return false;
	const cursor = editor.getCursor("from");
	const textBeforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
	editor.replaceSelection(sequenceInsertion(preview.notes.map(linkTo), sequence, separator, textBeforeCursor));
	return true;
}
