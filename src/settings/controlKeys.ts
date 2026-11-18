import { t } from "../i18n/index.ts";
import { DAY_MONTH_ORDERS, NEXT_WEEKDAY_MEANINGS, WEEK_STARTS } from "../settings.ts";
import type { DateCompassSettings } from "../settings.ts";
import { PERIOD_FIELDS, TEMPLATE_RUNNER_CHOICES, isPeriod, normalizeFolder } from "../dateNotes/periods.ts";
import type { Period, PeriodField } from "../dateNotes/periods.ts";
import { MENTION_FIELDS, withoutWhitespace } from "../mentions/settings.ts";
import type { Mention, MentionField } from "../mentions/settings.ts";
import { ALIAS_SHAPES, LINK_SEPARATORS, LINK_STYLE_FIELDS, isLinkTemplate, validTargets } from "../insertion/linkStyle.ts";
import type { LinkStyle, LinkStyleField } from "../insertion/linkStyle.ts";
import { LINK_PATHS } from "../insertion/linkPath.ts";
import { COMMAND_FIELDS, ASK_KINDS, WRITE_MODES } from "../commands/settings.ts";
import type { CommandField, DateCommand } from "../commands/settings.ts";

export const WEEK_START_KEY = "weekStart";

export const NEXT_WEEKDAY_KEY = "nextWeekday";

export const DAY_MONTH_ORDER_KEY = "dayMonthOrder";

export const TEMPLATE_RUNNER_KEY = "dateNotes/templateRunner";

const MENTION_KEY_PREFIX = "mentions/";

export type MentionControlField = MentionField | LinkStyleField;

const MENTION_CONTROL_FIELDS: readonly MentionControlField[] = [...MENTION_FIELDS, ...LINK_STYLE_FIELDS];

export function mentionKeyPrefix(mentionId: string): string {
	return `${MENTION_KEY_PREFIX}${mentionId}`;
}

export function linkStyleKey(keyPrefix: string, field: LinkStyleField): string {
	return `${keyPrefix}/${field}`;
}

export function mentionKey(mentionId: string, field: MentionControlField): string {
	return `${mentionKeyPrefix(mentionId)}/${field}`;
}

export interface MentionKeyParts {
	mentionId: string;
	field: MentionControlField;
}

export function mentionKeyParts(key: string): MentionKeyParts | undefined {
	if (!key.startsWith(MENTION_KEY_PREFIX)) return undefined;
	const parts = key.slice(MENTION_KEY_PREFIX.length).split("/");
	const field = MENTION_CONTROL_FIELDS.find((known) => known === parts[1]);
	return parts.length === 2 && field ? { mentionId: parts[0], field } : undefined;
}

interface MentionControl {
	mention: Mention;
	field: MentionControlField;
}

function mentionControlOfKey(settings: DateCompassSettings, key: string): MentionControl | undefined {
	const parts = mentionKeyParts(key);
	const mention = parts && settings.mentions.find((candidate) => candidate.id === parts.mentionId);
	return parts && mention ? { mention, field: parts.field } : undefined;
}

function writeMentionControl({ mention, field }: MentionControl, value: unknown): boolean {
	if (field !== "trigger") return writeLinkStyleControl(mention, field, value);
	if (typeof value !== "string" || triggerError(value)) return false;
	mention.trigger = withoutWhitespace(value);
	return true;
}

function writeLinkStyleControl(style: LinkStyle, field: LinkStyleField, value: unknown): boolean {
	switch (field) {
		case "targets":
			return writeTargets(style, value);
		case "linkPath":
			return writeChoice(LINK_PATHS, value, (choice) => (style.linkPath = choice));
		case "separator":
			return writeChoice(LINK_SEPARATORS, value, (choice) => (style.separator = choice));
		case "aliasShape":
			return writeChoice(ALIAS_SHAPES, value, (choice) => (style.aliasShape = choice));
		case "template":
			if (typeof value !== "string" || linkTemplateError(value)) return false;
			style.template = value;
			return true;
		case "aliasFormat":
			if (typeof value !== "string" || formatError(value)) return false;
			style.aliasFormat = value.trim();
			return true;
	}
}

function writeTargets(style: LinkStyle, value: unknown): boolean {
	const targets = validTargets(value);
	if (!Array.isArray(value) || targets.length === 0 || targets.length !== value.length) return false;
	style.targets = targets;
	return true;
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

const COMMAND_KEY_PREFIX = "commands/";

const TYPED_COMMAND_FIELDS = ["name", "property"];

export function isCommandKey(key: string): boolean {
	return key.startsWith(COMMAND_KEY_PREFIX);
}

export function isTypedCommandKey(key: string): boolean {
	return isCommandKey(key) && TYPED_COMMAND_FIELDS.includes(key.split("/").pop() ?? "");
}

export function commandKey(commandId: string, field: CommandField): string {
	return `${COMMAND_KEY_PREFIX}${commandId}/${field}`;
}

interface CommandControl {
	command: DateCommand;
	field: CommandField;
}

function commandControlOfKey(settings: DateCompassSettings, key: string): CommandControl | undefined {
	if (!key.startsWith(COMMAND_KEY_PREFIX)) return undefined;
	const parts = key.slice(COMMAND_KEY_PREFIX.length).split("/");
	const command = settings.commands.find((candidate) => candidate.id === parts[0]);
	const field = COMMAND_FIELDS.find((known) => known === parts[1]);
	return parts.length === 2 && command && field ? { command, field } : undefined;
}

function readCommandControl({ command, field }: CommandControl): unknown {
	return command[field];
}

function writeCommandControl({ command, field }: CommandControl, value: unknown): boolean {
	switch (field) {
		case "link":
			return writeBoolean(value, (link) => (command.link = link));
		case "asks":
			return writeChoice(ASK_KINDS, value, (asks) => (command.asks = asks));
		case "mode":
			return writeChoice(WRITE_MODES, value, (mode) => (command.mode = mode));
		case "name":
			return writeText(value, (name) => (command.name = name));
		case "property":
			return writeText(value, (property) => (command.property = property));
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
	const commandControl = commandControlOfKey(settings, key);
	if (commandControl) return readCommandControl(commandControl);
	if (key === WEEK_START_KEY) return settings.weekStart;
	if (key === NEXT_WEEKDAY_KEY) return settings.nextWeekday;
	if (key === DAY_MONTH_ORDER_KEY) return settings.dayMonthOrder;
	if (key === TEMPLATE_RUNNER_KEY) return settings.dateNotes.templateRunner;
	const periodField = periodFieldOfKey(key);
	if (periodField) return settings.dateNotes.periods[periodField.period][periodField.field];
	const mentionControl = mentionControlOfKey(settings, key);
	return mentionControl ? mentionControl.mention[mentionControl.field] : undefined;
}

export function writeControl(settings: DateCompassSettings, key: string, value: unknown): boolean {
	const commandControl = commandControlOfKey(settings, key);
	if (commandControl) return writeCommandControl(commandControl, value);
	if (key === WEEK_START_KEY) return writeChoice(WEEK_STARTS, value, (choice) => (settings.weekStart = choice));
	if (key === NEXT_WEEKDAY_KEY) return writeChoice(NEXT_WEEKDAY_MEANINGS, value, (choice) => (settings.nextWeekday = choice));
	if (key === DAY_MONTH_ORDER_KEY) return writeChoice(DAY_MONTH_ORDERS, value, (choice) => (settings.dayMonthOrder = choice));
	if (key === TEMPLATE_RUNNER_KEY) return writeChoice(TEMPLATE_RUNNER_CHOICES, value, (choice) => (settings.dateNotes.templateRunner = choice));
	const periodField = periodFieldOfKey(key);
	if (periodField) return writePeriodField(settings, periodField.period, periodField.field, value);
	const mentionControl = mentionControlOfKey(settings, key);
	return mentionControl ? writeMentionControl(mentionControl, value) : false;
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
