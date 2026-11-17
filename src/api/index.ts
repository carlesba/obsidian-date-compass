import type { Moment } from "moment";
import { buildRows } from "../mentions/rows.ts";
import type { DateParser, NoteRef } from "../mentions/rows.ts";
import { dateOf, notePath } from "../dateNotes/paths.ts";
import type { MomentFactory } from "../dateNotes/paths.ts";
import { isPeriod } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";
import { parse as parsePhrase } from "../parse/index.ts";
import type { ParseOptions, PeriodNode } from "../parse/index.ts";
import { resolve as resolveNode } from "../parse/resolve.ts";
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

function isMomentLike(value: unknown): value is Moment {
	return typeof value === "object" && value !== null && typeof (value as Partial<Moment>).toDate === "function" && typeof (value as Partial<Moment>).isValid === "function";
}

export function createDateCompassApi(host: DateCompassApiHost): DateCompassApi {
	const momentOf = (date: unknown): Moment => {
		const value = typeof date === "string" ? host.moment(date, ISO_DATE, true) : date instanceof Date || isMomentLike(date) ? host.moment(date) : undefined;
		if (!value?.isValid()) throw new TypeError(`Date Compass: "${String(date)}" is not a date; pass a Date, a moment or YYYY-MM-DD`);
		return value;
	};
	const enabledPeriodOf = (period: unknown): Period => {
		if (!isPeriod(period)) throw new TypeError(`Date Compass: "${String(period)}" is not a period; use day, week, month, quarter or year`);
		if (!host.settings().dateNotes.periods[period].enabled) throw new TypeError(`Date Compass: ${period} notes are turned off in Date notes`);
		return period;
	};
	const noteOf = ({ period, start, date, name, path }: NoteRef): DateCompassNote => ({
		period,
		start: start.format(ISO_DATE),
		date: date.format(ISO_DATE),
		name,
		path,
	});
	const rowsOf = (text: string, now: Moment, parser: DateParser) =>
		buildRows(text, {
			now,
			moment: host.moment,
			options: host.parseOptions(),
			periods: host.settings().dateNotes.periods,
			allows: () => true,
			parser,
		});
	const parse = (text: string, now?: Date | Moment): DateCompassInterpretation[] =>
		rowsOf(text, now === undefined ? host.moment() : momentOf(now), { parse: parsePhrase, complete: () => [] }).map((row) => ({
			language: row.language,
			notes: row.notes.map(noteOf),
		}));
	const resolve = (text: string, now?: Date | Moment): DateCompassInterpretation | undefined => parse(text, now)[0];
	const noteAt = (path: string): DateCompassNote | undefined => {
		const found = dateOf(path, host.settings().dateNotes.periods, host.moment);
		if (!found) return undefined;
		const node: PeriodNode = {
			kind: "period",
			unit: found.period,
			anchor: { containing: { kind: "calendar", year: found.date.year(), month: found.date.month() + 1, day: found.date.date() } },
		};
		const periodOfPath: DateParser = {
			parse: (_text, now, options) => {
				const outcome = resolveNode(node, now, options);
				return outcome && outcome.kind !== "tooManyItems" ? [{ language: "", node, result: outcome }] : [];
			},
			complete: () => [],
		};
		const note = rowsOf(path, host.moment(), periodOfPath)[0]?.notes[0];
		return note && note.path === path ? noteOf(note) : undefined;
	};
	return Object.freeze({
		parse,
		resolve,
		sequence: (text: string, now?: Date | Moment) => resolve(text, now)?.notes ?? [],
		notePath: (date: DateInput, period: Period) => notePath(momentOf(date), enabledPeriodOf(period), host.settings().dateNotes.periods),
		dateOf: noteAt,
		openNote: async (date: DateInput, period: Period) => host.openDateNote(momentOf(date), enabledPeriodOf(period)),
	});
}
