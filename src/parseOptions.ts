import type { ParseOptions } from "./parse/index.ts";
import type { DateCompassSettings, WeekStart } from "./settings.ts";

export function parserWeekStart(weekStart: WeekStart, localeFirstDayOfWeek: number): ParseOptions["weekStart"] {
	if (weekStart === "locale") return localeFirstDayOfWeek === 0 ? "sunday" : "monday";
	return weekStart;
}

export function parseOptionsOf(settings: DateCompassSettings, localeFirstDayOfWeek: number): ParseOptions {
	return {
		languages: [...settings.languages],
		weekStart: parserWeekStart(settings.weekStart, localeFirstDayOfWeek),
		nextWeekday: settings.nextWeekday,
		dayMonthOrder: settings.dayMonthOrder,
	};
}
