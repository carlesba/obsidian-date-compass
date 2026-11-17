import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
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

export function registerDateNoteCommands(plugin: Plugin, settings: () => DateNotesSettings): void {
	const { app } = plugin;
	const openNote = async (date: Moment, period: Period) => {
		const path = await ensureDateNote(createDateNoteHost(app), settings(), date, period);
		const file = path ? app.vault.getFileByPath(path) : null;
		if (file) await app.workspace.getLeaf(false).openFile(file);
	};
	for (const period of PERIODS) {
		const { id, name } = CURRENT_PERIOD_COMMANDS[period];
		plugin.addCommand({
			id,
			name: t(name),
			checkCallback: (checking) => {
				if (!settings().periods[period].enabled) return false;
				if (!checking) void openNote(obsidianMoment(), period);
				return true;
			},
		});
	}
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

