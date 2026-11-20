import type { App } from "obsidian";
import { dateOf, fileNameParts } from "../dateNotes/paths.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { decoratorName } from "../settings/calendarPage.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { weeksAroundGrid } from "./grid.ts";
import type { MonthGrid } from "./grid.ts";
import { headerParts } from "./header.ts";
import { calendarModel } from "./model.ts";
import type { CalendarModel } from "./model.ts";
import { momentOf, monthShortName, weekdayShortNames } from "./obsidianHost.ts";
import type { NoteDotsReader } from "./obsidianHost.ts";
import { visibleNotes } from "./paths.ts";
import { agendaRows, selectedCellUse, selectedRange, visibleCellUse, weeksCovering } from "./agenda.ts";
import type { AgendaRow, AgendaScope, SelectedDateNote } from "./agenda.ts";
import type { WeekRule } from "./weeks.ts";

export interface ScreenContext {
	app: App;
	settings: DateCompassSettings;
	dots: NoteDotsReader;
	today: CivilDate;
	rule: WeekRule;
	activePath: string | undefined;
}

export interface CalendarModels {
	models: CalendarModel[];
	paths: Set<string>;
}

export function calendarModels(context: ScreenContext, grids: readonly MonthGrid[], showWeekNumbers: boolean): CalendarModels {
	const { app, settings, dots, today, rule, activePath } = context;
	const { periods } = settings.dateNotes;
	const { decorators } = settings.calendar;
	const paths = new Set<string>();
	const models = grids.map((grid) => {
		const notes = visibleNotes(grid, periods, momentOf);
		for (const path of notes.visiblePaths) paths.add(path);
		return calendarModel({
			grid,
			today,
			notes,
			parts: headerParts(grid.month, monthShortName(grid.month), periods),
			rule,
			weekdayNames: weekdayShortNames(),
			showWeekNumbers,
			activePath,
			noteExists: (path) => app.vault.getFileByPath(path) !== null,
			showsDotsAbove: decorators.some((decorator) => decorator.position === "above"),
			dotsOf: (path, place, hasNote, days) => dots.dotsOf(path, place, hasNote, days, decorators),
		});
	});
	return { models, paths };
}

export interface Agenda {
	rows: AgendaRow[];
	paths: Set<string>;
}

export function agendaOf(context: ScreenContext, scope: AgendaScope, visible: readonly CalendarModel[], selected: SelectedDateNote | undefined): Agenda {
	const { app, settings, rule, today } = context;
	const listed = settings.calendar.decorators.filter((decorator) => decorator.inAgenda).map((decorator) => decorator.id);
	const nameOf = (path: string) => noteName(app, path);
	if (scope === "visible") return { rows: agendaRows(visible, visibleCellUse, listed, nameOf), paths: new Set() };
	if (!selected) return { rows: [], paths: new Set() };
	const range = selectedRange(selected, rule);
	const grid = weeksAroundGrid(range.start, weeksCovering(range, rule), 0, rule, today);
	const { models, paths } = calendarModels(context, [grid], true);
	return { rows: agendaRows(models, selectedCellUse(selected, range), listed, nameOf), paths };
}

export function dotName(settings: DateCompassSettings, decoratorId: string): string {
	const decorator = settings.calendar.decorators.find((candidate) => candidate.id === decoratorId);
	return decorator ? decoratorName(decorator) : "";
}

export function noteName(app: App, path: string): string {
	return app.vault.getFileByPath(path)?.basename ?? fileNameParts(path).basename;
}

export function focusedDateNote(app: App, settings: DateCompassSettings): SelectedDateNote | undefined {
	const path = app.workspace.getActiveFile()?.path;
	const note = path ? dateOf(path, settings.dateNotes.periods, obsidianMoment) : undefined;
	if (!path || !note) return undefined;
	return { path, period: note.period, date: { year: note.date.year(), month: note.date.month() + 1, day: note.date.date() } };
}
