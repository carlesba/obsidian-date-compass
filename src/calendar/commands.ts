import { Notice } from "obsidian";
import type { App, Plugin } from "obsidian";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import { dateOf } from "../dateNotes/paths.ts";
import { t } from "../i18n/index.ts";
import type { DateCompassSettings } from "../settings.ts";
import { CALENDAR_ICON, CALENDAR_VIEW_TYPE, CalendarView } from "./view.ts";

export function registerCalendar(plugin: Plugin, settings: () => DateCompassSettings): void {
	const { app } = plugin;
	plugin.registerView(CALENDAR_VIEW_TYPE, (leaf) => new CalendarView(leaf, settings));
	plugin.registerHoverLinkSource(CALENDAR_VIEW_TYPE, { display: t("calendarViewTitle"), defaultMod: true });
	plugin.addRibbonIcon(CALENDAR_ICON, t("calendarRibbonTooltip"), () => void revealCalendar(app));
	plugin.addCommand({ id: "open-calendar", name: t("openCalendar"), callback: () => void revealCalendar(app) });
	plugin.addCommand({
		id: "reveal-active-note-in-calendar",
		name: t("revealActiveNoteInCalendar"),
		callback: () => void revealActiveNote(app, settings()),
	});
}

export function refreshCalendars(app: App): void {
	for (const leaf of app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)) {
		if (leaf.view instanceof CalendarView) leaf.view.refresh();
	}
}

async function revealCalendar(app: App): Promise<CalendarView | undefined> {
	const { workspace } = app;
	const open = workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)[0];
	const leaf = open ?? workspace.getRightLeaf(false);
	if (!leaf) return undefined;
	if (!open) await leaf.setViewState({ type: CALENDAR_VIEW_TYPE, active: true });
	await workspace.revealLeaf(leaf);
	return leaf.view instanceof CalendarView ? leaf.view : undefined;
}

async function revealActiveNote(app: App, settings: DateCompassSettings): Promise<void> {
	const active = app.workspace.getActiveFile();
	const note = active ? dateOf(active.path, settings.dateNotes.periods, obsidianMoment) : undefined;
	if (!note) {
		new Notice(t("activeNoteNotADateNote"));
		return;
	}
	const calendar = await revealCalendar(app);
	calendar?.showDate({ year: note.date.year(), month: note.date.month() + 1, day: note.date.date() });
}
