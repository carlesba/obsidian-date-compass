import type { Moment } from "moment";
import { PERIODS } from "./periods.ts";
import type { Period, PeriodSettingsByPeriod } from "./periods.ts";

export type MomentFactory = (input?: string | number | Date | Moment, format?: string, strict?: boolean) => Moment;

export interface DateNote {
	date: Moment;
	period: Period;
}

const MOMENT_UNITS: Record<Period, "day" | "isoWeek" | "month" | "quarter" | "year"> = {
	day: "day",
	week: "isoWeek",
	month: "month",
	quarter: "quarter",
	year: "year",
};

export function noteName(date: Moment, period: Period, periods: PeriodSettingsByPeriod): string {
	return date.format(periods[period].format);
}

export function notePath(date: Moment, period: Period, periods: PeriodSettingsByPeriod): string {
	const { folder } = periods[period];
	const name = `${noteName(date, period, periods)}.md`;
	return folder === "" ? name : `${folder}/${name}`;
}

export function dateOf(path: string, periods: PeriodSettingsByPeriod, moment: MomentFactory): DateNote | undefined {
	if (!path.endsWith(".md")) return undefined;
	const withoutExtension = path.slice(0, -".md".length);
	for (const period of PERIODS) {
		const { enabled, folder, format } = periods[period];
		if (!enabled) continue;
		const name = nameInFolder(withoutExtension, folder);
		if (name === undefined) continue;
		const date = moment(name, format, true);
		if (date.isValid() && date.format(format) === name) return { date: startOfPeriod(date, period, format), period };
	}
	return undefined;
}

export function nearestDateNote(
	current: DateNote,
	direction: 1 | -1,
	paths: readonly string[],
	periods: PeriodSettingsByPeriod,
	moment: MomentFactory,
): string | undefined {
	let best: { path: string; date: Moment } | undefined;
	for (const path of paths) {
		const note = dateOf(path, periods, moment);
		if (!note || note.period !== current.period) continue;
		const distance = note.date.diff(current.date) * direction;
		if (distance <= 0) continue;
		if (!best || note.date.diff(best.date) * direction < 0) best = { path, date: note.date };
	}
	return best?.path;
}

function nameInFolder(path: string, folder: string): string | undefined {
	if (folder === "") return path;
	const prefix = `${folder}/`;
	return path.startsWith(prefix) ? path.slice(prefix.length) : undefined;
}

function startOfPeriod(date: Moment, period: Period, format: string): Moment {
	if (period === "week" && !/G|W/.test(format.replace(/\[[^\]]*\]/g, ""))) return date.clone().startOf("week");
	return date.clone().startOf(MOMENT_UNITS[period]);
}
