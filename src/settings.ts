import { mergeActions } from "./actions/settings.ts";
import type { DateAction } from "./actions/settings.ts";
import { mergeDateNotes } from "./dateNotes/periods.ts";
import type { DateNotesSettings } from "./dateNotes/periods.ts";
import { mergeMentions } from "./mentions/settings.ts";
import type { MentionSettings } from "./mentions/settings.ts";
import { mergeSequence } from "./sequence/settings.ts";
import type { SequenceSettings } from "./sequence/settings.ts";

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
	dateNotes: DateNotesSettings;
	mentions: MentionSettings;
	insertSequence: SequenceSettings;
	actions: DateAction[];
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
		dateNotes: mergeDateNotes(data.dateNotes),
		mentions: mergeMentions(data.mentions),
		insertSequence: mergeSequence(data.insertSequence),
		actions: mergeActions(data.actions),
	};
}

function readLanguages(stored: unknown): ParserLanguage[] | undefined {
	if (!Array.isArray(stored)) return undefined;
	return stored.filter((language, index): language is ParserLanguage => isParserLanguage(language) && stored.indexOf(language) === index);
}

function oneOf<Choice extends string>(choices: readonly Choice[], stored: unknown, fallback: Choice): Choice {
	return choices.find((choice) => choice === stored) ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
