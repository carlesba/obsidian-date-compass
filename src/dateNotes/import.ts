import { PERIODS, formatOr, isRecord, normalizeFolder } from "./periods.ts";
import type { DateNotesSettings, Period, PeriodSettings } from "./periods.ts";

export type DateNoteSource = "periodicNotes" | "dailyNotes";

export interface ExternalDateNotes {
	periodicNotes?: unknown;
	dailyNotes?: unknown;
}

export type ExternalPeriods = Partial<Record<Period, PeriodSettings>>;

export interface PeriodMismatch {
	period: Period;
	field: "folder" | "format";
	theirs: string;
	ours: string;
}

export interface SourceMismatch {
	source: DateNoteSource;
	differences: PeriodMismatch[];
}

const PERIODIC_NOTES_KEYS: Record<Period, string> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

const PERIODIC_NOTES_DEFAULT_FORMATS: Record<Period, string> = {
	day: "YYYY-MM-DD",
	week: "gggg-[W]ww",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

const DAILY_NOTES_DEFAULT_FORMAT = "YYYY-MM-DD";

export function periodicNotesPeriods(data: unknown): ExternalPeriods | undefined {
	if (!isRecord(data)) return undefined;
	const periods: ExternalPeriods = {};
	for (const period of PERIODS) {
		const entry = data[PERIODIC_NOTES_KEYS[period]];
		if (!isRecord(entry)) continue;
		periods[period] = {
			enabled: entry.enabled === true,
			folder: normalizeFolder(entry.folder),
			format: formatOr(entry.format, PERIODIC_NOTES_DEFAULT_FORMATS[period]),
			template: templatePath(entry.template),
		};
	}
	return Object.keys(periods).length > 0 ? periods : undefined;
}

export function dailyNotesPeriods(options: unknown): ExternalPeriods | undefined {
	if (!isRecord(options)) return undefined;
	return {
		day: {
			enabled: true,
			folder: normalizeFolder(options.folder),
			format: formatOr(options.format, DAILY_NOTES_DEFAULT_FORMAT),
			template: templatePath(options.template),
		},
	};
}

export function sourcePeriods(source: DateNoteSource, external: ExternalDateNotes): ExternalPeriods | undefined {
	return source === "periodicNotes" ? periodicNotesPeriods(external.periodicNotes) : dailyNotesPeriods(external.dailyNotes);
}

export function importDateNotes(settings: DateNotesSettings, external: ExternalDateNotes): DateNoteSource | undefined {
	if (settings.imported) return undefined;
	settings.imported = true;
	const source: DateNoteSource | undefined = periodicNotesPeriods(external.periodicNotes)
		? "periodicNotes"
		: dailyNotesPeriods(external.dailyNotes)
			? "dailyNotes"
			: undefined;
	if (!source) return undefined;
	const periods = sourcePeriods(source, external) ?? {};
	for (const period of PERIODS) {
		const imported = periods[period];
		if (imported) settings.periods[period] = { ...imported };
	}
	return source;
}

export function dateNoteMismatches(settings: DateNotesSettings, external: ExternalDateNotes): SourceMismatch[] {
	const sources: DateNoteSource[] = ["periodicNotes", "dailyNotes"];
	return sources.flatMap((source) => {
		const differences = differencesFrom(settings, sourcePeriods(source, external) ?? {});
		return differences.length > 0 ? [{ source, differences }] : [];
	});
}

export function copyFromSource(settings: DateNotesSettings, source: DateNoteSource, external: ExternalDateNotes): boolean {
	const differences = differencesFrom(settings, sourcePeriods(source, external) ?? {});
	for (const { period, field, theirs } of differences) settings.periods[period][field] = theirs;
	return differences.length > 0;
}

function differencesFrom(settings: DateNotesSettings, theirs: ExternalPeriods): PeriodMismatch[] {
	return PERIODS.flatMap((period) => {
		const external = theirs[period];
		if (!external?.enabled) return [];
		const ours = settings.periods[period];
		const fields = ["folder", "format"] as const;
		return fields
			.filter((field) => external[field] !== ours[field])
			.map((field) => ({ period, field, theirs: external[field], ours: ours[field] }));
	});
}

function templatePath(template: unknown): string {
	const path = normalizeFolder(template);
	if (path === "") return "";
	return path.endsWith(".md") ? path : `${path}.md`;
}
