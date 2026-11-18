import type { Command } from "obsidian";
import { commandName, commandWarning } from "./settings.ts";
import type { DateCommand } from "./settings.ts";

export interface CommandHost {
	addCommand(command: Command): unknown;
	removeCommand(id: string): void;
}

export interface PaletteCommand {
	id: string;
	name: string;
	command: DateCommand;
}

export function paletteCommandId(command: DateCommand): string {
	return `command-${command.id}`;
}

export function paletteCommands(commands: readonly DateCommand[]): PaletteCommand[] {
	return commands.filter((command) => !commandWarning(command)).map((command) => ({ id: paletteCommandId(command), name: commandName(command), command }));
}

export class PaletteCommands {
	private registered: string[] = [];
	private readonly host: CommandHost;
	private readonly command: (entry: PaletteCommand) => Command;

	constructor(host: CommandHost, command: (entry: PaletteCommand) => Command) {
		this.host = host;
		this.command = command;
	}

	sync(commands: readonly DateCommand[]): void {
		for (const id of this.registered) this.host.removeCommand(id);
		this.registered = [];
		for (const entry of paletteCommands(commands)) {
			this.host.addCommand(this.command(entry));
			this.registered.push(entry.id);
		}
	}
}
