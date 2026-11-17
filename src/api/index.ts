import type { Moment } from "moment";
import { buildRows } from "../mentions/rows.ts";
import type { NoteRef } from "../mentions/rows.ts";
import { dateOf, notePath } from "../dateNotes/paths.ts";
import type { MomentFactory } from "../dateNotes/paths.ts";
import { isPeriod } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";
import { parse as parsePhrase } from "../parse/index.ts";
import type { ParseOptions } from "../parse/index.ts";
import type { DateCompassSettings } from "../settings.ts";

export type { Period } from "../dateNotes/periods.ts";

export type DateInput = Date | Moment | string;

export interface DateCompassNote {
	period: Period;
	start: string;
	date: string;
	name: string;
	path: string;
}

export interface DateCompassInterpretation {
	language: string;
	notes: DateCompassNote[];
}

export interface DateCompassApi {
	parse(text: string, now?: Date | Moment): DateCompassInterpretation[];
	resolve(text: string, now?: Date | Moment): DateCompassInterpretation | undefined;
	sequence(text: string, now?: Date | Moment): DateCompassNote[];
	notePath(date: DateInput, period: Period): string;
	dateOf(path: string): DateCompassNote | undefined;
	openNote(date: DateInput, period: Period): Promise<void>;
}

export interface DateCompassApiHost {
	settings(): DateCompassSettings;
	parseOptions(): ParseOptions;
	moment: MomentFactory;
	openDateNote(date: Moment, period: Period): Promise<void>;
}

const ISO_DATE = "YYYY-MM-DD";

export function createDateCompassApi(host: DateCompassApiHost): DateCompassApi {
	const momentOf = (date: DateInput): Moment => {
		const value = typeof date === "string" ? host.moment(date, ISO_DATE, true) : host.moment(date);
		if (!value.isValid()) throw new TypeError(`Date Compass: "${String(date)}" is not a date; pass a Date, a moment or YYYY-MM-DD`);
		return value;
	};
	const periodOf = (period: unknown): Period => {
		if (!isPeriod(period)) throw new TypeError(`Date Compass: "${String(period)}" is not a period; use day, week, month, quarter or year`);
		return period;
	};
	const noteOf = ({ period, start, date, name, path }: NoteRef): DateCompassNote => ({
		period,
		start: start.format(ISO_DATE),
		date: date.format(ISO_DATE),
		name,
		path,
	});
	const parse = (text: string, now?: Date | Moment): DateCompassInterpretation[] =>
		buildRows(text, {
			now: now === undefined ? host.moment() : momentOf(now),
			moment: host.moment,
			options: host.parseOptions(),
			periods: host.settings().dateNotes.periods,
			allows: () => true,
			parser: { parse: parsePhrase, complete: () => [] },
		}).map((row) => ({ language: row.language, notes: row.notes.map(noteOf) }));
	const resolve = (text: string, now?: Date | Moment): DateCompassInterpretation | undefined => parse(text, now)[0];
	return Object.freeze({
		parse,
		resolve,
		sequence: (text: string, now?: Date | Moment) => resolve(text, now)?.notes ?? [],
		notePath: (date: DateInput, period: Period) => notePath(momentOf(date), periodOf(period), host.settings().dateNotes.periods),
		dateOf: (path: string): DateCompassNote | undefined => {
			const note = dateOf(path, host.settings().dateNotes.periods, host.moment);
			if (!note) return undefined;
			const start = note.date.format(ISO_DATE);
			return { period: note.period, start, date: start, name: path.slice(path.lastIndexOf("/") + 1, -".md".length), path };
		},
		openNote: (date: DateInput, period: Period) => host.openDateNote(momentOf(date), periodOf(period)),
	});
}
