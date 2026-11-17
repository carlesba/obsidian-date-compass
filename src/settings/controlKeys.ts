import { t } from "../i18n/index.ts";
import { DAY_MONTH_ORDERS, NEXT_WEEKDAY_MEANINGS, PARSER_LANGUAGES, WEEK_STARTS } from "../settings.ts";
import type { DateCompassSettings, ParserLanguage } from "../settings.ts";
import { PERIOD_FIELDS, TEMPLATE_RUNNER_CHOICES, isPeriod, normalizeFolder } from "../dateNotes/periods.ts";
import type { Period, PeriodField } from "../dateNotes/periods.ts";
import { ALIAS_MODES, LINK_SEPARATORS, withoutWhitespace } from "../mentions/settings.ts";
import { SEQUENCE_LAYOUTS, isItemTemplate } from "../sequence/settings.ts";

export const WEEK_START_KEY = "weekStart";

export const NEXT_WEEKDAY_KEY = "nextWeekday";

export const DAY_MONTH_ORDER_KEY = "dayMonthOrder";

export const TEMPLATE_RUNNER_KEY = "dateNotes/templateRunner";

export const MENTIONS_ENABLED_KEY = "mentions/enabled";

export const MENTIONS_TRIGGER_KEY = "mentions/trigger";

export const MENTIONS_ALIAS_MODE_KEY = "mentions/aliasMode";

export const MENTIONS_ALIAS_FORMAT_KEY = "mentions/aliasFormat";

export const MENTIONS_SEPARATOR_KEY = "mentions/separator";

export const SEQUENCE_LAYOUT_KEY = "insertSequence/layout";

export const SEQUENCE_ITEM_TEMPLATE_KEY = "insertSequence/itemTemplate";

const MENTION_PERIOD_KEY_PREFIX = "mentions/periods/";

export function mentionPeriodKey(period: Period): string {
	return `${MENTION_PERIOD_KEY_PREFIX}${period}`;
}

function mentionPeriodOfKey(key: string): Period | undefined {
	if (!key.startsWith(MENTION_PERIOD_KEY_PREFIX)) return undefined;
	const period = key.slice(MENTION_PERIOD_KEY_PREFIX.length);
	return isPeriod(period) ? period : undefined;
}

const LANGUAGE_KEY_PREFIX = "languages/";

const PERIOD_KEY_PREFIX = "dateNotes/";

export function periodKey(period: Period, field: PeriodField): string {
	return `${PERIOD_KEY_PREFIX}${period}/${field}`;
}

function periodFieldOfKey(key: string): { period: Period; field: PeriodField } | undefined {
	if (!key.startsWith(PERIOD_KEY_PREFIX)) return undefined;
	const [period, field] = key.slice(PERIOD_KEY_PREFIX.length).split("/");
	const knownField = PERIOD_FIELDS.find((known) => known === field);
	return isPeriod(period) && knownField ? { period, field: knownField } : undefined;
}

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
	if (key === TEMPLATE_RUNNER_KEY) return settings.dateNotes.templateRunner;
	const periodField = periodFieldOfKey(key);
	if (periodField) return settings.dateNotes.periods[periodField.period][periodField.field];
	if (key === MENTIONS_ENABLED_KEY) return settings.mentions.enabled;
	if (key === MENTIONS_TRIGGER_KEY) return settings.mentions.trigger;
	if (key === MENTIONS_ALIAS_MODE_KEY) return settings.mentions.aliasMode;
	if (key === MENTIONS_ALIAS_FORMAT_KEY) return settings.mentions.aliasFormat;
	if (key === MENTIONS_SEPARATOR_KEY) return settings.mentions.separator;
	const mentionPeriod = mentionPeriodOfKey(key);
	if (mentionPeriod) return settings.mentions.periods[mentionPeriod];
	if (key === SEQUENCE_LAYOUT_KEY) return settings.insertSequence.layout;
	if (key === SEQUENCE_ITEM_TEMPLATE_KEY) return settings.insertSequence.itemTemplate;
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
	if (key === TEMPLATE_RUNNER_KEY) return writeChoice(TEMPLATE_RUNNER_CHOICES, value, (choice) => (settings.dateNotes.templateRunner = choice));
	const periodField = periodFieldOfKey(key);
	if (periodField) return writePeriodField(settings, periodField.period, periodField.field, value);
	if (key === SEQUENCE_LAYOUT_KEY) return writeChoice(SEQUENCE_LAYOUTS, value, (choice) => (settings.insertSequence.layout = choice));
	if (key === SEQUENCE_ITEM_TEMPLATE_KEY) {
		if (typeof value !== "string" || itemTemplateError(value)) return false;
		settings.insertSequence.itemTemplate = value;
		return true;
	}
	return writeMentionControl(settings, key, value);
}

function writeMentionControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const { mentions } = settings;
	if (key === MENTIONS_ALIAS_MODE_KEY) return writeChoice(ALIAS_MODES, value, (choice) => (mentions.aliasMode = choice));
	if (key === MENTIONS_SEPARATOR_KEY) return writeChoice(LINK_SEPARATORS, value, (choice) => (mentions.separator = choice));
	const mentionPeriod = mentionPeriodOfKey(key);
	if (key === MENTIONS_ENABLED_KEY || mentionPeriod) {
		if (typeof value !== "boolean") return false;
		if (mentionPeriod) mentions.periods[mentionPeriod] = value;
		else mentions.enabled = value;
		return true;
	}
	if (typeof value !== "string") return false;
	if (key === MENTIONS_TRIGGER_KEY) {
		if (triggerError(value)) return false;
		mentions.trigger = withoutWhitespace(value);
		return true;
	}
	if (key === MENTIONS_ALIAS_FORMAT_KEY) {
		if (formatError(value)) return false;
		mentions.aliasFormat = value.trim();
		return true;
	}
	return false;
}

export function triggerError(value: string): string | undefined {
	return withoutWhitespace(value) === "" ? t("triggerRequired") : undefined;
}

function writePeriodField(settings: DateCompassSettings, period: Period, field: PeriodField, value: unknown): boolean {
	const periodSettings = settings.dateNotes.periods[period];
	if (field === "enabled") {
		if (typeof value !== "boolean") return false;
		periodSettings.enabled = value;
		return true;
	}
	if (typeof value !== "string") return false;
	if (field === "folder") periodSettings.folder = normalizeFolder(value);
	else if (field === "template") periodSettings.template = value.trim();
	else if (formatError(value)) return false;
	else periodSettings.format = value.trim();
	return true;
}

export function itemTemplateError(value: string): string | undefined {
	return isItemTemplate(value) ? undefined : t("itemTemplateNeedsLink");
}

export function formatError(value: string): string | undefined {
	return value.trim() === "" ? t("formatRequired") : undefined;
}

function writeChoice<Choice extends string>(choices: readonly Choice[], value: unknown, write: (choice: Choice) => unknown): boolean {
	const choice = choices.find((known) => known === value);
	if (choice === undefined) return false;
	write(choice);
	return true;
}
