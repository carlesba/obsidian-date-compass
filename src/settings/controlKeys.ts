import { DAY_MONTH_ORDERS, NEXT_WEEKDAY_MEANINGS, PARSER_LANGUAGES, WEEK_STARTS } from "../settings.ts";
import type { DateCompassSettings, ParserLanguage } from "../settings.ts";

export const WEEK_START_KEY = "weekStart";

export const NEXT_WEEKDAY_KEY = "nextWeekday";

export const DAY_MONTH_ORDER_KEY = "dayMonthOrder";

const LANGUAGE_KEY_PREFIX = "languages/";

export function languageKey(language: ParserLanguage): string {
	return `${LANGUAGE_KEY_PREFIX}${language}`;
}

function languageOfKey(key: string): ParserLanguage | undefined {
	if (!key.startsWith(LANGUAGE_KEY_PREFIX)) return undefined;
	const language = key.slice(LANGUAGE_KEY_PREFIX.length);
	return PARSER_LANGUAGES.find((known) => known === language);
}

export function readControl(settings: DateCompassSettings, key: string): unknown {
	const language = languageOfKey(key);
	if (language) return settings.languages.includes(language);
	if (key === WEEK_START_KEY) return settings.weekStart;
	if (key === NEXT_WEEKDAY_KEY) return settings.nextWeekday;
	if (key === DAY_MONTH_ORDER_KEY) return settings.dayMonthOrder;
	return undefined;
}

export function writeControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const language = languageOfKey(key);
	if (language) {
		const others = settings.languages.filter((enabled) => enabled !== language);
		settings.languages = PARSER_LANGUAGES.filter((known) => others.includes(known) || (known === language && value === true));
		return true;
	}
	if (key === WEEK_START_KEY) return writeChoice(WEEK_STARTS, value, (choice) => (settings.weekStart = choice));
	if (key === NEXT_WEEKDAY_KEY) return writeChoice(NEXT_WEEKDAY_MEANINGS, value, (choice) => (settings.nextWeekday = choice));
	if (key === DAY_MONTH_ORDER_KEY) return writeChoice(DAY_MONTH_ORDERS, value, (choice) => (settings.dayMonthOrder = choice));
	return false;
}

function writeChoice<Choice extends string>(choices: readonly Choice[], value: unknown, write: (choice: Choice) => unknown): boolean {
	const choice = choices.find((known) => known === value);
	if (choice === undefined) return false;
	write(choice);
	return true;
}
