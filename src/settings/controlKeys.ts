import { t } from "../i18n/index.ts";
import { DAY_MONTH_ORDERS, NEXT_WEEKDAY_MEANINGS, PARSER_LANGUAGES, WEEK_STARTS } from "../settings.ts";
import type { DateCompassSettings, ParserLanguage } from "../settings.ts";
import { PERIOD_FIELDS, TEMPLATE_RUNNER_CHOICES, isPeriod, normalizeFolder } from "../dateNotes/periods.ts";
import type { Period, PeriodField } from "../dateNotes/periods.ts";
import { ALIAS_MODES, LINK_SEPARATORS, withoutWhitespace } from "../mentions/settings.ts";
import { SEQUENCE_LAYOUTS, isItemTemplate } from "../sequence/settings.ts";
import { ACTION_FIELDS, INPUT_FIELDS, INPUT_TYPES, PROPERTY_MODES, VALUE_FORMATS, WRITE_FIELDS, WRITE_TARGETS, WRITE_VALUES } from "../actions/settings.ts";
import type { ActionField, ActionInput, ActionWrite, DateAction, InputField, WriteField } from "../actions/settings.ts";

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

const ACTION_KEY_PREFIX = "actions/";

const TYPED_ACTION_FIELDS = ["name", "key", "question", "defaultText", "property"];

export function isActionKey(key: string): boolean {
	return key.startsWith(ACTION_KEY_PREFIX);
}

export function isTypedActionKey(key: string): boolean {
	return isActionKey(key) && TYPED_ACTION_FIELDS.includes(key.split("/").pop() ?? "");
}

export function actionKey(actionId: string, field: ActionField): string {
	return `${ACTION_KEY_PREFIX}${actionId}/${field}`;
}

export function inputKey(actionId: string, inputId: string, field: InputField): string {
	return `${ACTION_KEY_PREFIX}${actionId}/inputs/${inputId}/${field}`;
}

export function writeKey(actionId: string, writeId: string, field: WriteField): string {
	return `${ACTION_KEY_PREFIX}${actionId}/writes/${writeId}/${field}`;
}

type ActionControl =
	| { kind: "action"; action: DateAction; field: ActionField }
	| { kind: "input"; action: DateAction; input: ActionInput; field: InputField }
	| { kind: "write"; action: DateAction; write: ActionWrite; field: WriteField };

function actionControlOfKey(settings: DateCompassSettings, key: string): ActionControl | undefined {
	if (!key.startsWith(ACTION_KEY_PREFIX)) return undefined;
	const parts = key.slice(ACTION_KEY_PREFIX.length).split("/");
	const action = settings.actions.find((candidate) => candidate.id === parts[0]);
	if (!action) return undefined;
	if (parts.length === 2) {
		const field = ACTION_FIELDS.find((known) => known === parts[1]);
		return field ? { kind: "action", action, field } : undefined;
	}
	if (parts.length !== 4) return undefined;
	const [, list, id, name] = parts;
	if (list === "inputs") {
		const input = action.inputs.find((candidate) => candidate.id === id);
		const field = INPUT_FIELDS.find((known) => known === name);
		return input && field ? { kind: "input", action, input, field } : undefined;
	}
	if (list === "writes") {
		const write = action.writes.find((candidate) => candidate.id === id);
		const field = WRITE_FIELDS.find((known) => known === name);
		return write && field ? { kind: "write", action, write, field } : undefined;
	}
	return undefined;
}

function readActionControl(control: ActionControl): unknown {
	if (control.kind === "action") return control.action[control.field];
	if (control.kind === "input") return control.input[control.field];
	return control.write[control.field];
}

function writeActionControl(control: ActionControl, value: unknown): boolean {
	if (control.kind === "action") {
		if (control.field === "enabled") return writeBoolean(value, (enabled) => (control.action.enabled = enabled));
		return writeText(value, (name) => (control.action.name = name));
	}
	if (control.kind === "input") {
		const { input } = control;
		switch (control.field) {
			case "type":
				return writeChoice(INPUT_TYPES, value, (type) => (input.type = type));
			case "optional":
				return writeBoolean(value, (optional) => (input.optional = optional));
			default: {
				const field = control.field;
				return writeText(value, (text) => (input[field] = text));
			}
		}
	}
	const { write } = control;
	switch (control.field) {
		case "target":
			return writeChoice(WRITE_TARGETS, value, (target) => (write.target = target));
		case "value":
			return writeChoice(WRITE_VALUES, value, (choice) => (write.value = choice));
		case "format":
			return writeChoice(VALUE_FORMATS, value, (format) => (write.format = format));
		case "mode":
			return writeChoice(PROPERTY_MODES, value, (mode) => (write.mode = mode));
		default: {
			const field = control.field;
			return writeText(value, (text) => (write[field] = text));
		}
	}
}

function writeBoolean(value: unknown, write: (value: boolean) => unknown): boolean {
	if (typeof value !== "boolean") return false;
	write(value);
	return true;
}

function writeText(value: unknown, write: (value: string) => unknown): boolean {
	if (typeof value !== "string") return false;
	write(value);
	return true;
}

export function readControl(settings: DateCompassSettings, key: string): unknown {
	const actionControl = actionControlOfKey(settings, key);
	if (actionControl) return readActionControl(actionControl);
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
	const actionControl = actionControlOfKey(settings, key);
	if (actionControl) return writeActionControl(actionControl, value);
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
