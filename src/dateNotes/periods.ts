export const PERIODS = ["day", "week", "month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_FIELDS = ["enabled", "folder", "format", "template"] as const;
export type PeriodField = (typeof PERIOD_FIELDS)[number];

export const TEMPLATE_RUNNER_CHOICES = ["automatic", "templater", "coreTemplates"] as const;
export type TemplateRunnerChoice = (typeof TEMPLATE_RUNNER_CHOICES)[number];

export interface PeriodSettings {
	enabled: boolean;
	folder: string;
	format: string;
	template: string;
}

export type PeriodSettingsByPeriod = Record<Period, PeriodSettings>;

export interface DateNotesSettings {
	imported: boolean;
	templateRunner: TemplateRunnerChoice;
	periods: PeriodSettingsByPeriod;
}

export const DEFAULT_FORMATS: Record<Period, string> = {
	day: "YYYY-MM-DD",
	week: "GGGG-[W]WW",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

const ENABLED_BY_DEFAULT: Record<Period, boolean> = {
	day: true,
	week: true,
	month: true,
	quarter: false,
	year: true,
};

export function isPeriod(value: unknown): value is Period {
	return PERIODS.some((period) => period === value);
}

export function mapPeriods(build: (period: Period) => PeriodSettings): PeriodSettingsByPeriod {
	return { day: build("day"), week: build("week"), month: build("month"), quarter: build("quarter"), year: build("year") };
}

export function defaultPeriod(period: Period): PeriodSettings {
	return { enabled: ENABLED_BY_DEFAULT[period], folder: "", format: DEFAULT_FORMATS[period], template: "" };
}

export function defaultDateNotes(): DateNotesSettings {
	return mergeDateNotes(undefined);
}

export function mergeDateNotes(stored: unknown): DateNotesSettings {
	const data = isRecord(stored) ? stored : {};
	const periods = isRecord(data.periods) ? data.periods : {};
	return {
		imported: data.imported === true,
		templateRunner: TEMPLATE_RUNNER_CHOICES.find((choice) => choice === data.templateRunner) ?? "automatic",
		periods: mapPeriods((period) => mergePeriod(period, periods[period])),
	};
}

function mergePeriod(period: Period, stored: unknown): PeriodSettings {
	const fallback = defaultPeriod(period);
	if (!isRecord(stored)) return fallback;
	return {
		enabled: typeof stored.enabled === "boolean" ? stored.enabled : fallback.enabled,
		folder: normalizeFolder(stored.folder),
		format: formatOr(stored.format, fallback.format),
		template: typeof stored.template === "string" ? stored.template.trim() : fallback.template,
	};
}

export function normalizeFolder(folder: unknown): string {
	return typeof folder === "string" ? folder.trim().replace(/^\/+|\/+$/g, "") : "";
}

export function formatOr(format: unknown, fallback: string): string {
	return typeof format === "string" && format.trim() !== "" ? format.trim() : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
