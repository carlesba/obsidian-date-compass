import { weekdayOf } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import type { WeekStart } from "../settings.ts";

export interface WeekRule {
	firstDayOfWeek: number;
	firstDayOfYear: number;
}

export type WeekFormatKind = "iso" | "locale" | "none";

export const ISO_WEEK_RULE: WeekRule = { firstDayOfWeek: 1, firstDayOfYear: 4 };

export const SUNDAY_WEEK_RULE: WeekRule = { firstDayOfWeek: 0, firstDayOfYear: 6 };

const DAY_MS = 86_400_000;

export function weekRuleOf(weekStart: WeekStart, locale: WeekRule): WeekRule {
	if (weekStart === "monday") return { ...ISO_WEEK_RULE };
	if (weekStart === "sunday") return { ...SUNDAY_WEEK_RULE };
	return { firstDayOfWeek: locale.firstDayOfWeek, firstDayOfYear: locale.firstDayOfYear };
}

export function sameWeekRule(one: WeekRule, other: WeekRule): boolean {
	return one.firstDayOfWeek === other.firstDayOfWeek && one.firstDayOfYear === other.firstDayOfYear;
}

export function weekNumber(date: CivilDate, rule: WeekRule): number {
	const week = Math.floor((dayOfYear(date) - firstWeekOffset(date.year, rule) - 1) / 7) + 1;
	if (week < 1) return week + weeksInYear(date.year - 1, rule);
	const weeksThisYear = weeksInYear(date.year, rule);
	return week > weeksThisYear ? week - weeksThisYear : week;
}

export function weekFormatKind(format: string): WeekFormatKind {
	const tokens = format.replace(/\[[^\]]*\]/g, "");
	if (/G|W/.test(tokens)) return "iso";
	if (/g|w/.test(tokens)) return "locale";
	return "none";
}

export function weekStartDisagreesWithFormat(rule: WeekRule, weekFormat: string, locale: WeekRule): boolean {
	const kind = weekFormatKind(weekFormat);
	if (kind === "iso") return !sameWeekRule(rule, ISO_WEEK_RULE);
	if (kind === "locale") return !sameWeekRule(rule, locale);
	return false;
}

function firstWeekOffset(year: number, { firstDayOfWeek, firstDayOfYear }: WeekRule): number {
	const dayAlwaysInFirstWeek = 7 + firstDayOfWeek - firstDayOfYear;
	const daysIntoItsWeek = (7 + weekdayOf({ year, month: 1, day: dayAlwaysInFirstWeek }) - firstDayOfWeek) % 7;
	return dayAlwaysInFirstWeek - daysIntoItsWeek - 1;
}

function weeksInYear(year: number, rule: WeekRule): number {
	return (daysInYear(year) - firstWeekOffset(year, rule) + firstWeekOffset(year + 1, rule)) / 7;
}

function daysInYear(year: number): number {
	return dayOfYear({ year, month: 12, day: 31 });
}

function dayOfYear({ year, month, day }: CivilDate): number {
	return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
}
