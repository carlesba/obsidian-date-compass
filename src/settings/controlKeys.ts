import { t } from "../i18n/index.ts";
import { DAY_MONTH_ORDERS, NEXT_WEEKDAY_MEANINGS, WEEK_STARTS } from "../settings.ts";
import type { DateCompassSettings } from "../settings.ts";
import { PERIOD_FIELDS, TEMPLATE_RUNNER_CHOICES, isPeriod, normalizeFolder } from "../dateNotes/periods.ts";
import type { Period, PeriodField } from "../dateNotes/periods.ts";
import { withoutWhitespace } from "../mentions/settings.ts";
import { ALIAS_SHAPES, LINK_SEPARATORS, isLinkTemplate } from "../insertion/settings.ts";
import { ACTION_FIELDS, INPUT_FIELDS, INPUT_TYPES, PROPERTY_MODES, VALUE_FORMATS, WRITE_FIELDS, WRITE_TARGETS, WRITE_VALUES } from "../actions/settings.ts";
import type { ActionField, ActionInput, ActionWrite, DateAction, InputField, WriteField } from "../actions/settings.ts";

export const WEEK_START_KEY = "weekStart";

export const NEXT_WEEKDAY_KEY = "nextWeekday";

export const DAY_MONTH_ORDER_KEY = "dayMonthOrder";

export const TEMPLATE_RUNNER_KEY = "dateNotes/templateRunner";

export const MENTIONS_ENABLED_KEY = "mentions/enabled";

export const MENTIONS_TRIGGER_KEY = "mentions/trigger";

export const INSERTION_LINK_TEMPLATE_KEY = "insertion/linkTemplate";

export const INSERTION_SEPARATOR_KEY = "insertion/separator";

export const INSERTION_ALIAS_BY_DEFAULT_KEY = "insertion/aliasByDefault";

export const INSERTION_ALIAS_SHAPE_KEY = "insertion/aliasShape";

export const INSERTION_ALIAS_FORMAT_KEY = "insertion/aliasFormat";

const INSERTION_KEY_PREFIX = "insertion/";

const MENTION_PERIOD_KEY_PREFIX = "mentions/periods/";

export function mentionPeriodKey(period: Period): string {
	return `${MENTION_PERIOD_KEY_PREFIX}${period}`;
}

function mentionPeriodOfKey(key: string): Period | undefined {
	if (!key.startsWith(MENTION_PERIOD_KEY_PREFIX)) return undefined;
	const period = key.slice(MENTION_PERIOD_KEY_PREFIX.length);
	return isPeriod(period) ? period : undefined;
}

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
	if (key === WEEK_START_KEY) return settings.weekStart;
	if (key === NEXT_WEEKDAY_KEY) return settings.nextWeekday;
	if (key === DAY_MONTH_ORDER_KEY) return settings.dayMonthOrder;
	if (key === TEMPLATE_RUNNER_KEY) return settings.dateNotes.templateRunner;
	const periodField = periodFieldOfKey(key);
	if (periodField) return settings.dateNotes.periods[periodField.period][periodField.field];
	if (key === MENTIONS_ENABLED_KEY) return settings.mentions.enabled;
	if (key === MENTIONS_TRIGGER_KEY) return settings.mentions.trigger;
	if (key === INSERTION_LINK_TEMPLATE_KEY) return settings.insertion.linkTemplate;
	if (key === INSERTION_SEPARATOR_KEY) return settings.insertion.separator;
	if (key === INSERTION_ALIAS_BY_DEFAULT_KEY) return settings.insertion.aliasByDefault;
	if (key === INSERTION_ALIAS_SHAPE_KEY) return settings.insertion.aliasShape;
	if (key === INSERTION_ALIAS_FORMAT_KEY) return settings.insertion.aliasFormat;
	const mentionPeriod = mentionPeriodOfKey(key);
	if (mentionPeriod) return settings.mentions.periods[mentionPeriod];
	return undefined;
}

export function writeControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const actionControl = actionControlOfKey(settings, key);
	if (actionControl) return writeActionControl(actionControl, value);
	if (key === WEEK_START_KEY) return writeChoice(WEEK_STARTS, value, (choice) => (settings.weekStart = choice));
	if (key === NEXT_WEEKDAY_KEY) return writeChoice(NEXT_WEEKDAY_MEANINGS, value, (choice) => (settings.nextWeekday = choice));
	if (key === DAY_MONTH_ORDER_KEY) return writeChoice(DAY_MONTH_ORDERS, value, (choice) => (settings.dayMonthOrder = choice));
	if (key === TEMPLATE_RUNNER_KEY) return writeChoice(TEMPLATE_RUNNER_CHOICES, value, (choice) => (settings.dateNotes.templateRunner = choice));
	const periodField = periodFieldOfKey(key);
	if (periodField) return writePeriodField(settings, periodField.period, periodField.field, value);
	if (key.startsWith(INSERTION_KEY_PREFIX)) return writeInsertionControl(settings, key, value);
	return writeMentionControl(settings, key, value);
}

function writeMentionControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const { mentions } = settings;
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
	return false;
}

function writeInsertionControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const { insertion } = settings;
	if (key === INSERTION_SEPARATOR_KEY) return writeChoice(LINK_SEPARATORS, value, (choice) => (insertion.separator = choice));
	if (key === INSERTION_ALIAS_SHAPE_KEY) return writeChoice(ALIAS_SHAPES, value, (choice) => (insertion.aliasShape = choice));
	if (key === INSERTION_ALIAS_BY_DEFAULT_KEY) return writeBoolean(value, (checked) => (insertion.aliasByDefault = checked));
	if (key === INSERTION_LINK_TEMPLATE_KEY) {
		if (typeof value !== "string" || linkTemplateError(value)) return false;
		insertion.linkTemplate = value;
		return true;
	}
	if (key === INSERTION_ALIAS_FORMAT_KEY) {
		if (typeof value !== "string" || formatError(value)) return false;
		insertion.aliasFormat = value.trim();
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

export function linkTemplateError(value: string): string | undefined {
	return isLinkTemplate(value) ? undefined : t("linkTemplateRequired");
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
