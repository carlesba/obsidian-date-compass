import { Notice } from "obsidian";
import type { App, Plugin } from "obsidian";
import { t } from "../i18n/index.ts";
import { CURRENT_PERIOD_COMMANDS, NEXT_DATE_NOTE_COMMAND, NEXT_PERIOD_COMMANDS, PREVIOUS_DATE_NOTE_COMMAND } from "./commandList.ts";
import type { ListedCommand } from "./commandList.ts";
import { ensureDateNote } from "./create.ts";
import { createDateNoteHost, obsidianMoment } from "./obsidianHost.ts";
import { dateOf, nearestDateNote } from "./paths.ts";
import { PERIODS } from "./periods.ts";
import type { DateNotesSettings, Period } from "./periods.ts";
import type { Moment } from "moment";

export type DateNotePane = "current" | "split";

export async function openDateNote(app: App, settings: DateNotesSettings, date: Moment, period: Period, pane: DateNotePane = "current"): Promise<void> {
	try {
		const path = await ensureDateNote(createDateNoteHost(app), settings, date, period);
		const file = path ? app.vault.getFileByPath(path) : null;
		if (file) await app.workspace.getLeaf(pane === "split" ? "split" : false).openFile(file);
	} catch (error) {
		new Notice(t("openDateNoteFailed", { error: error instanceof Error ? error.message : String(error) }));
	}
}

export function registerDateNoteCommands(plugin: Plugin, settings: () => DateNotesSettings): void {
	const { app } = plugin;
	const openNote = (date: Moment, period: Period) => openDateNote(app, settings(), date, period);
	const addPeriodCommand = ({ id, name, icon }: ListedCommand, period: Period, periodsAhead: number) =>
		plugin.addCommand({
			id,
			name: t(name),
			icon,
			checkCallback: (checking) => {
				if (!settings().periods[period].enabled) return false;
				if (!checking) void openNote(obsidianMoment().add(periodsAhead, period), period);
				return true;
			},
		});
	for (const period of PERIODS) addPeriodCommand(CURRENT_PERIOD_COMMANDS[period], period, 0);
	for (const period of PERIODS) addPeriodCommand(NEXT_PERIOD_COMMANDS[period], period, 1);
	const step = (direction: 1 | -1) => (checking: boolean) => {
		const active = app.workspace.getActiveFile();
		const current = active ? dateOf(active.path, settings().periods, obsidianMoment) : undefined;
		if (!current) return false;
		if (checking) return true;
		const paths = app.vault.getMarkdownFiles().map((file) => file.path);
		const target = nearestDateNote(current, direction, paths, settings().periods, obsidianMoment);
		const file = target ? app.vault.getFileByPath(target) : null;
		if (file) void app.workspace.getLeaf(false).openFile(file);
		else new Notice(t(direction === 1 ? "noNextDateNote" : "noPreviousDateNote"));
		return true;
	};
	const addStepCommand = ({ id, name, icon }: ListedCommand, direction: 1 | -1) => plugin.addCommand({ id, name: t(name), icon, checkCallback: step(direction) });
	addStepCommand(NEXT_DATE_NOTE_COMMAND, 1);
	addStepCommand(PREVIOUS_DATE_NOTE_COMMAND, -1);
}

