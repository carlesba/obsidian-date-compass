import type { Moment } from "moment";
import type { Editor, EditorPosition } from "obsidian";
import { t } from "../i18n/index.ts";
import { parseWithRefusals } from "../parse/index.ts";
import type { Analysis, ParseOptions } from "../parse/index.ts";
import { PHRASE_PARSER, buildRows, noteCount, rangeDescription, rowLabel } from "../mentions/rows.ts";
import type { DateRow, NoteRef, RowContext } from "../mentions/rows.ts";
import { insertionText } from "../insertion/render.ts";
import type { LinkSeparator } from "../insertion/settings.ts";

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

export type CursorEditor = Pick<Editor, "getCursor" | "getLine" | "replaceSelection">;

export type InsertionEditor = CursorEditor & Pick<Editor, "replaceRange">;

export interface InsertionRange {
	start: EditorPosition;
	end: EditorPosition;
}

export function insertAtCursor(editor: CursorEditor, links: readonly string[], separator: LinkSeparator): void {
	const cursor = editor.getCursor("from");
	const textBeforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
	editor.replaceSelection(insertionText(links, separator, textBeforeCursor));
}

export function insertLinks(editor: InsertionEditor, links: readonly string[], separator: LinkSeparator, range?: InsertionRange): void {
	if (!range) return insertAtCursor(editor, links, separator);
	const textBeforeRange = editor.getLine(range.start.line).slice(0, range.start.ch);
	editor.replaceRange(insertionText(links, separator, textBeforeRange), range.start, range.end);
}
