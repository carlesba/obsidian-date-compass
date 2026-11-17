export const PARSER_LANGUAGES = ["en", "es"] as const;
export type ParserLanguage = (typeof PARSER_LANGUAGES)[number];

export const WEEK_STARTS = ["locale", "monday", "sunday"] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

export const NEXT_WEEKDAY_MEANINGS = ["nextWeek", "nextOccurrence"] as const;
export type NextWeekdayMeaning = (typeof NEXT_WEEKDAY_MEANINGS)[number];

export const DAY_MONTH_ORDERS = ["dayMonth", "monthDay"] as const;
export type DayMonthOrder = (typeof DAY_MONTH_ORDERS)[number];

export interface DateCompassSettings {
	languages: ParserLanguage[];
	weekStart: WeekStart;
	nextWeekday: NextWeekdayMeaning;
	dayMonthOrder: DayMonthOrder;
}

export function isParserLanguage(value: unknown): value is ParserLanguage {
	return PARSER_LANGUAGES.some((language) => language === value);
}

export function defaultLanguages(interfaceLanguage: string): ParserLanguage[] {
	return isParserLanguage(interfaceLanguage) && interfaceLanguage !== "en" ? [interfaceLanguage, "en"] : ["en"];
}

export function defaultSettings(interfaceLanguage = "en"): DateCompassSettings {
	return mergeSettings(undefined, interfaceLanguage);
}

export function mergeSettings(stored: unknown, interfaceLanguage = "en"): DateCompassSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		languages: readLanguages(data.languages) ?? defaultLanguages(interfaceLanguage),
		weekStart: oneOf(WEEK_STARTS, data.weekStart, "locale"),
		nextWeekday: oneOf(NEXT_WEEKDAY_MEANINGS, data.nextWeekday, "nextWeek"),
		dayMonthOrder: oneOf(DAY_MONTH_ORDERS, data.dayMonthOrder, "dayMonth"),
	};
}

function readLanguages(stored: unknown): ParserLanguage[] | undefined {
	if (!Array.isArray(stored)) return undefined;
	return PARSER_LANGUAGES.filter((language) => stored.includes(language));
}

function oneOf<Choice extends string>(choices: readonly Choice[], stored: unknown, fallback: Choice): Choice {
	return choices.find((choice) => choice === stored) ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
