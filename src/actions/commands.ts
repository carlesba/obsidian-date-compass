import type { Command } from "obsidian";
import { actionName, actionWarning } from "./settings.ts";
import type { DateAction } from "./settings.ts";

export interface CommandHost {
	addCommand(command: Command): unknown;
	removeCommand(id: string): void;
}

export interface ActionCommand {
	id: string;
	name: string;
	action: DateAction;
}

export function actionCommandId(action: DateAction): string {
	return `action-${action.id}`;
}

export function actionCommands(actions: readonly DateAction[]): ActionCommand[] {
	return actions.filter((action) => action.enabled && !actionWarning(action)).map((action) => ({ id: actionCommandId(action), name: actionName(action), action }));
}

export class ActionCommands {
	private registered: string[] = [];
	private readonly host: CommandHost;
	private readonly command: (entry: ActionCommand) => Command;

	constructor(host: CommandHost, command: (entry: ActionCommand) => Command) {
		this.host = host;
		this.command = command;
	}

	sync(actions: readonly DateAction[]): void {
		for (const id of this.registered) this.host.removeCommand(id);
		this.registered = [];
		for (const entry of actionCommands(actions)) {
			this.host.addCommand(this.command(entry));
			this.registered.push(entry.id);
		}
	}
}
