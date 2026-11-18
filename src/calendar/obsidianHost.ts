import { moment } from "obsidian";
import type { WeekRule } from "./weeks.ts";

export function localeWeekRule(): WeekRule {
	const locale = moment.localeData();
	return { firstDayOfWeek: locale.firstDayOfWeek(), firstDayOfYear: locale.firstDayOfYear() };
}
