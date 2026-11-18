import { Notice } from "obsidian";
import type { App, Plugin } from "obsidian";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { ensureDateNote } from "./create.ts";
import { createDateNoteHost, obsidianMoment } from "./obsidianHost.ts";
import { dateOf, nearestDateNote } from "./paths.ts";
import { PERIODS } from "./periods.ts";
import type { DateNotesSettings, Period } from "./periods.ts";
import type { Moment } from "moment";

const CURRENT_PERIOD_COMMANDS: Record<Period, { id: string; name: TranslationKey }> = {
	day: { id: "open-today", name: "openTodayNote" },
	week: { id: "open-this-week", name: "openThisWeekNote" },
	month: { id: "open-this-month", name: "openThisMonthNote" },
	quarter: { id: "open-this-quarter", name: "openThisQuarterNote" },
	year: { id: "open-this-year", name: "openThisYearNote" },
};

const NEXT_PERIOD_COMMANDS: Record<Period, { id: string; name: TranslationKey }> = {
	day: { id: "open-tomorrow", name: "openTomorrowNote" },
	week: { id: "open-next-week", name: "openNextWeekNote" },
	month: { id: "open-next-month", name: "openNextMonthNote" },
	quarter: { id: "open-next-quarter", name: "openNextQuarterNote" },
	year: { id: "open-next-year", name: "openNextYearNote" },
};

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
	const addPeriodCommand = ({ id, name }: { id: string; name: TranslationKey }, period: Period, periodsAhead: number) =>
		plugin.addCommand({
			id,
			name: t(name),
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
	plugin.addCommand({ id: "open-next-date-note", name: t("openNextDateNote"), checkCallback: step(1) });
	plugin.addCommand({ id: "open-previous-date-note", name: t("openPreviousDateNote"), checkCallback: step(-1) });
}

