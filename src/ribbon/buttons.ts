import { PALETTE_COMMAND_ICON, PALETTE_COMMAND_ID_PREFIX, paletteCommandId, paletteCommands } from "../commands/palette.ts";
import { commandName, commandWarning } from "../commands/settings.ts";
import type { DateCommand } from "../commands/settings.ts";
import { CURRENT_PERIOD_COMMANDS, NEXT_DATE_NOTE_COMMAND, NEXT_PERIOD_COMMANDS, OPEN_BY_PHRASE_COMMAND, PREVIOUS_DATE_NOTE_COMMAND } from "../dateNotes/commandList.ts";
import type { ListedCommand } from "../dateNotes/commandList.ts";
import { PERIODS } from "../dateNotes/periods.ts";
import type { DateNotesSettings, Period } from "../dateNotes/periods.ts";
import { t } from "../i18n/index.ts";

export interface RibbonSource {
	dateNotes: DateNotesSettings;
	commands: readonly DateCommand[];
}

export interface RibbonCommand {
	id: string;
	name: string;
	icon: string;
}

export type RibbonProblem = { kind: "periodOff"; period: Period } | { kind: "incomplete"; reason: string } | { kind: "missing" };

export interface RibbonEntry {
	id: string;
	name?: string;
	icon?: string;
	problem?: RibbonProblem;
}

export interface RibbonButton {
	commandId: string;
	title: string;
	icon: string;
}

interface BuiltInCommand extends ListedCommand {
	period?: Period;
}

const BUILT_IN_COMMANDS: readonly BuiltInCommand[] = [
	...PERIODS.map((period) => ({ ...CURRENT_PERIOD_COMMANDS[period], period })),
	...PERIODS.map((period) => ({ ...NEXT_PERIOD_COMMANDS[period], period })),
	NEXT_DATE_NOTE_COMMAND,
	PREVIOUS_DATE_NOTE_COMMAND,
	OPEN_BY_PHRASE_COMMAND,
];

function isPaletteCommandId(id: string): boolean {
	return id.startsWith(PALETTE_COMMAND_ID_PREFIX) && id.length > PALETTE_COMMAND_ID_PREFIX.length && !id.includes("/");
}

export function canBeRibbonCommand(id: string): boolean {
	return BUILT_IN_COMMANDS.some((command) => command.id === id) || isPaletteCommandId(id);
}

export function mergeRibbonButtons(stored: unknown): string[] {
	if (!Array.isArray(stored)) return [];
	return stored.filter((id, index): id is string => typeof id === "string" && canBeRibbonCommand(id) && stored.indexOf(id) === index);
}

function builtInEntry(command: BuiltInCommand, source: RibbonSource): RibbonEntry {
	const off = command.period !== undefined && !source.dateNotes.periods[command.period].enabled;
	return { id: command.id, name: t(command.name), icon: command.icon, ...(off && command.period ? { problem: { kind: "periodOff", period: command.period } } : {}) };
}

function paletteEntry(id: string, source: RibbonSource): RibbonEntry {
	const command = source.commands.find((candidate) => paletteCommandId(candidate) === id);
	if (!command) return { id, problem: { kind: "missing" } };
	const reason = commandWarning(command);
	return { id, name: commandName(command), icon: PALETTE_COMMAND_ICON, ...(reason ? { problem: { kind: "incomplete", reason } } : {}) };
}

export function ribbonEntries(listed: readonly string[], source: RibbonSource): RibbonEntry[] {
	return listed.map((id) => {
		const builtIn = BUILT_IN_COMMANDS.find((command) => command.id === id);
		return builtIn ? builtInEntry(builtIn, source) : paletteEntry(id, source);
	});
}

export function availableRibbonCommands(source: RibbonSource): RibbonCommand[] {
	const builtIn = BUILT_IN_COMMANDS.filter((command) => command.period === undefined || source.dateNotes.periods[command.period].enabled);
	return [
		...builtIn.map(({ id, name, icon }) => ({ id, name: t(name), icon })),
		...paletteCommands(source.commands).map(({ id, name }) => ({ id, name, icon: PALETTE_COMMAND_ICON })),
	];
}

export function ribbonCommandsToAdd(listed: readonly string[], source: RibbonSource): RibbonCommand[] {
	return availableRibbonCommands(source).filter((command) => !listed.includes(command.id));
}

function freeTitle(name: string, taken: readonly string[]): string {
	if (!taken.includes(name)) return name;
	for (let number = 2; ; number++) {
		const title = `${name} (${number})`;
		if (!taken.includes(title)) return title;
	}
}

export function ribbonButtons(listed: readonly string[], source: RibbonSource, takenTitles: readonly string[] = []): RibbonButton[] {
	const taken = [...takenTitles];
	const buttons: RibbonButton[] = [];
	for (const { id, name, icon, problem } of ribbonEntries(listed, source)) {
		if (problem || name === undefined || icon === undefined) continue;
		const title = freeTitle(name, taken);
		taken.push(title);
		buttons.push({ commandId: id, title, icon });
	}
	return buttons;
}

export function addRibbonCommand(listed: readonly string[], id: string): string[] {
	return listed.includes(id) ? [...listed] : [...listed, id];
}

export function moveRibbonCommand(listed: readonly string[], from: number, to: number): string[] {
	const moved = [...listed];
	moved.splice(to, 0, ...moved.splice(from, 1));
	return moved;
}

export function removeRibbonCommand(listed: readonly string[], position: number): string[] {
	return listed.filter((_, index) => index !== position);
}
