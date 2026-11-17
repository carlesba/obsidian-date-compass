import type { Moment } from "moment";
import { t } from "../i18n/index.ts";
import { complete, parse } from "../parse/index.ts";
import type { Completion, Interpretation, ParseOptions, Span } from "../parse/index.ts";
import { noteName, notePath } from "../dateNotes/paths.ts";
import type { MomentFactory } from "../dateNotes/paths.ts";
import { PERIODS, isPeriod } from "../dateNotes/periods.ts";
import type { Period, PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { MentionSettings } from "./settings.ts";

export interface DateParser {
	parse(text: string, now: Date, options: ParseOptions): Interpretation[];
	complete(text: string, now: Date, options: ParseOptions): Completion[];
}

export const PHRASE_PARSER: DateParser = { parse, complete };

export interface RowContext {
	now: Moment;
	moment: MomentFactory;
	options: ParseOptions;
	periods: PeriodSettingsByPeriod;
	allows: (period: Period) => boolean;
	parser?: DateParser;
}

export interface NoteRef {
	period: Period;
	start: Moment;
	date: Moment;
	name: string;
	path: string;
}

export interface DateRow {
	source: "interpretation" | "completion";
	text: string;
	language: string;
	notes: NoteRef[];
}

const ISO_DATE = "YYYY-MM-DD";

const DAYS_INTO_WEEK_THAT_NAME_IT = 3;

export function buildRows(query: string, context: RowContext): DateRow[] {
	const text = query.trim();
	if (text === "") return [];
	const parser = context.parser ?? PHRASE_PARSER;
	const now = context.now.toDate();
	const candidates = [
		...parser.parse(text, now, context.options).map((interpretation) => ({ source: "interpretation" as const, text, interpretation })),
		...parser.complete(text, now, context.options).flatMap((completion) =>
			completion.interpretations.map((interpretation) => ({ source: "completion" as const, text: completion.text, interpretation })),
		),
	];
	const rows: DateRow[] = [];
	const seen = new Set<string>();
	for (const { source, text: phrase, interpretation } of candidates) {
		const notes = notesOf(interpretation, context);
		if (!notes) continue;
		const key = notes.map((note) => note.path).join("\n");
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push({ source, text: phrase, language: interpretation.language, notes });
	}
	return rows;
}

export function singleNoteRows(rows: readonly DateRow[]): DateRow[] {
	return rows.filter((row) => row.notes.length === 1);
}

export function currentNoteRows(context: RowContext): DateRow[] {
	return PERIODS.flatMap((period) => {
		const interpretation: Interpretation = {
			language: "",
			node: { kind: "period", unit: period, anchor: { offset: 0 } },
			result: { kind: "single", span: { unit: period, start: currentPeriodStart(context, period).format(ISO_DATE), end: "" } },
		};
		const notes = notesOf(interpretation, context);
		return notes ? [{ source: "interpretation" as const, text: "", language: "", notes }] : [];
	});
}

function currentPeriodStart(context: RowContext, period: Period): Moment {
	const today = context.now.clone().startOf("day");
	if (period === "day") return today;
	if (period !== "week") return today.startOf(period);
	const firstDay = context.options.weekStart === "sunday" ? 0 : 1;
	return today.subtract((today.day() - firstDay + 7) % 7, "days");
}

export function mayStillMatch(query: string, context: RowContext): boolean {
	const text = query.trim();
	if (text === "") return true;
	if (buildRows(text, context).length > 0) return true;
	const parser = context.parser ?? PHRASE_PARSER;
	return parser.complete(text, context.now.toDate(), context.options).some((completion) => completion.interpretations.length === 0);
}

function notesOf({ result }: Interpretation, context: RowContext): NoteRef[] | undefined {
	const spans = result.kind === "sequence" ? result.items : [result.span];
	const notes: NoteRef[] = [];
	for (const span of spans) {
		const note = noteOf(span, context);
		if (!note) return undefined;
		notes.push(note);
	}
	return notes.length > 0 ? notes : undefined;
}

function noteOf(span: Span, context: RowContext): NoteRef | undefined {
	const period = span.unit;
	if (!isPeriod(period) || !context.periods[period].enabled || !context.allows(period)) return undefined;
	const start = context.moment(span.start, ISO_DATE, true);
	if (!start.isValid()) return undefined;
	const date = period === "week" ? start.clone().add(DAYS_INTO_WEEK_THAT_NAME_IT, "days") : start;
	return { period, start, date, name: noteName(date, period, context.periods), path: notePath(date, period, context.periods) };
}

export function mentionAllows(mention: MentionSettings): (period: Period) => boolean {
	return (period) => mention.periods[period];
}

function dayFormat(day: Moment, now: Moment): string {
	return day.year() === now.year() ? "ddd D MMM" : "ddd D MMM YYYY";
}

export function noteDescription(note: NoteRef, now: Moment): string {
	switch (note.period) {
		case "day":
			return note.start.format(dayFormat(note.start, now));
		case "week":
			return t("weekOf", { start: note.start.format(dayFormat(note.start, now)) });
		case "month":
			return note.start.format("MMMM YYYY");
		case "quarter":
			return note.start.format("[Q]Q YYYY");
		case "year":
			return note.start.format("YYYY");
	}
}

export function noteCount(notes: readonly NoteRef[]): string {
	return t(notes.every((note) => note.period === "day") ? "dateCount" : "noteCount", { count: notes.length });
}

export function rangeDescription(notes: readonly NoteRef[], now: Moment, between: string): string {
	const first = notes[0];
	const last = notes[notes.length - 1];
	if (first.period === "day" && last.period === "day" && first.start.isSame(last.start, "month") && first.start.year() === now.year()) {
		return `${first.start.format("ddd D")}${between}${last.start.format("ddd D MMM")}`;
	}
	return `${noteDescription(first, now)}${between}${noteDescription(last, now)}`;
}

function sequenceDescription(notes: readonly NoteRef[], now: Moment): string {
	return `${rangeDescription(notes, now, " → ")} · ${noteCount(notes)}`;
}

export function rowLabel(row: DateRow, now: Moment): string {
	if (row.notes.length > 1) return sequenceDescription(row.notes, now);
	const [note] = row.notes;
	return `${noteDescription(note, now)} → [[${note.name}]]`;
}
