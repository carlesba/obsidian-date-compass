import type { Moment } from "moment";
import { t } from "../i18n/index.ts";
import { complete, parse } from "../parse/index.ts";
import type { Completion, Interpretation, ParseOptions } from "../parse/index.ts";
import { noteName, notePath } from "../dateNotes/paths.ts";
import type { MomentFactory } from "../dateNotes/paths.ts";
import { isPeriod } from "../dateNotes/periods.ts";
import type { Period, PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { LinkSeparator, MentionSettings } from "./settings.ts";

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

export interface DateRow {
	source: "interpretation" | "completion";
	text: string;
	language: string;
	period: Period;
	start: Moment;
	date: Moment;
	name: string;
	path: string;
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
		const row = rowOf(source, phrase, interpretation, context);
		if (!row || seen.has(row.path)) continue;
		seen.add(row.path);
		rows.push(row);
	}
	return rows;
}

function rowOf(source: DateRow["source"], text: string, { language, result }: Interpretation, context: RowContext): DateRow | undefined {
	const period = result.span.unit;
	if (!isPeriod(period) || !context.periods[period].enabled || !context.allows(period)) return undefined;
	const start = context.moment(result.span.start, ISO_DATE, true);
	if (!start.isValid()) return undefined;
	const date = period === "week" ? start.clone().add(DAYS_INTO_WEEK_THAT_NAME_IT, "days") : start;
	return {
		source,
		text,
		language,
		period,
		start,
		date,
		name: noteName(date, period, context.periods),
		path: notePath(date, period, context.periods),
	};
}

export function mentionAllows(mention: MentionSettings): (period: Period) => boolean {
	return (period) => mention.periods[period];
}

export function rowDescription(row: DateRow, now: Moment): string {
	switch (row.period) {
		case "day":
			return row.start.format(row.start.year() === now.year() ? "ddd D MMM" : "ddd D MMM YYYY");
		case "week":
			return t("weekOf", { start: row.start.format(row.start.year() === now.year() ? "ddd D MMM" : "ddd D MMM YYYY") });
		case "month":
			return row.start.format("MMMM YYYY");
		case "quarter":
			return row.start.format("[Q]Q YYYY");
		case "year":
			return row.start.format("YYYY");
	}
}

export function rowLabel(row: DateRow, now: Moment): string {
	return `${rowDescription(row, now)} → [[${row.name}]]`;
}

export function aliasOf(row: DateRow, mention: Pick<MentionSettings, "aliasMode" | "aliasFormat">): string | undefined {
	if (mention.aliasMode === "typed") return row.text;
	if (mention.aliasMode === "format") return row.start.format(mention.aliasFormat);
	return undefined;
}

export function joinLinks(links: readonly string[], separator: LinkSeparator): string {
	if (links.length < 2) return links.join("");
	if (separator === "space") return links.join(" ");
	if (separator === "bulletLines") return links.map((link) => `- ${link}`).join("\n");
	return links.join(", ");
}
