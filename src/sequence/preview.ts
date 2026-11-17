import type { Moment } from "moment";
import { t } from "../i18n/index.ts";
import { parseWithRefusals } from "../parse/index.ts";
import type { ParseOptions, Refusal } from "../parse/index.ts";
import { PHRASE_PARSER, buildRows, insertionText, noteCount, rangeDescription, rowLabel } from "../mentions/rows.ts";
import type { DateRow, NoteRef, RowContext } from "../mentions/rows.ts";
import type { LinkSeparator } from "../mentions/settings.ts";
import { LINK_PLACEHOLDER } from "./settings.ts";
import type { SequenceSettings } from "./settings.ts";

export type RefusalFinder = (text: string, now: Date, options: ParseOptions) => Refusal[];

export interface SequenceContext extends RowContext {
	refusals?: RefusalFinder;
}

export type SequencePreview = { kind: "empty" } | { kind: "dates"; notes: NoteRef[]; text: string } | { kind: "invalid"; text: string };

const PARSER_REFUSALS: RefusalFinder = (text, now, options) => parseWithRefusals(text, now, options).refusals;

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
	const [refusal] = (context.refusals ?? PARSER_REFUSALS)(text, now, context.options);
	if (refusal) return t("sequenceTooLong", { limit: refusal.limit });
	if ((context.parser ?? PHRASE_PARSER).parse(text, now, context.options).length > 0) return t("sequencePeriodOff");
	return t("sequenceNotADate");
}

export function sequenceInsertion(links: readonly string[], sequence: SequenceSettings, separator: LinkSeparator, textBeforeCursor: string): string {
	const items = links.map((link) => sequence.itemTemplate.split(LINK_PLACEHOLDER).join(link));
	switch (sequence.layout) {
		case "inline":
			return insertionText(items, separator, textBeforeCursor);
		case "bulletList":
			return insertionText(items, "bulletLines", textBeforeCursor);
		case "linePerItem":
			return items.join("\n");
	}
}
