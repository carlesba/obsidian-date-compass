import { t } from "../i18n/index.ts";
import { isRecord } from "../dateNotes/periods.ts";
import { defaultLinkStyle, mergeLinkStyle } from "../insertion/linkStyle.ts";
import type { LinkStyle } from "../insertion/linkStyle.ts";
import { freeId, uniqueId } from "../settings/entryList.ts";

export const ASK_KINDS = ["date", "dates"] as const;
export type AskKind = (typeof ASK_KINDS)[number];

export const WRITE_MODES = ["add", "replace"] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

export const COMMAND_DESTINATIONS = ["property", "cursor"] as const;
export type CommandDestination = (typeof COMMAND_DESTINATIONS)[number];

const COMMAND_ID_PREFIX = "command";

export const COMMAND_FIELDS = ["name", "destination", "property", "mode", "asks", "link"] as const;
export type CommandField = (typeof COMMAND_FIELDS)[number];

export interface DateCommand extends LinkStyle {
	id: string;
	name: string;
	destination: CommandDestination;
	property: string;
	mode: WriteMode;
	asks: AskKind;
	link: boolean;
}

export function presetCommands(): DateCommand[] {
	return [
		{ ...defaultLinkStyle(), id: "insert-dates", name: t("insertDates"), destination: "cursor", property: "", mode: "add", asks: "dates", link: true },
	];
}

function isWriteMode(value: unknown): value is WriteMode {
	return WRITE_MODES.some((mode) => mode === value);
}

export function mergeCommands(stored: unknown): DateCommand[] {
	if (!Array.isArray(stored)) return presetCommands();
	const commands: DateCommand[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		commands.push(mergeCommand(entry, commands));
	}
	return commands;
}

function isAskKind(value: unknown): value is AskKind {
	return ASK_KINDS.some((kind) => kind === value);
}

function mergeCommand(data: Record<string, unknown>, earlier: readonly DateCommand[]): DateCommand {
	return {
		...mergeLinkStyle(data),
		id: uniqueId(data.id, earlier, COMMAND_ID_PREFIX),
		name: text(data.name),
		destination: COMMAND_DESTINATIONS.find((destination) => destination === data.destination) ?? "property",
		property: text(data.property),
		mode: isWriteMode(data.mode) ? data.mode : "add",
		asks: isAskKind(data.asks) ? data.asks : "dates",
		link: typeof data.link === "boolean" ? data.link : true,
	};
}

export function newCommand(commands: readonly DateCommand[], now: number = Date.now()): DateCommand {
	return { ...defaultLinkStyle(), id: freeId(commands, `${COMMAND_ID_PREFIX}-${now.toString(36)}`), name: "", destination: "property", property: "", mode: "add", asks: "dates", link: true };
}

export function commandName(command: DateCommand): string {
	return command.name.trim() === "" ? t("untitledCommand") : command.name.trim();
}

export function commandWarning(command: DateCommand): string | undefined {
	return command.destination === "property" && command.property.trim() === "" ? t("commandNeedsProperty") : undefined;
}

export function questionOf(command: DateCommand): string {
	if (command.destination === "cursor") return commandName(command);
	return t(command.asks === "date" ? "commandAsksDate" : "commandAsksDates", { name: command.property.trim() });
}

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}
