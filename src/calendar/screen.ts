import type { App } from "obsidian";
import { dateOf, fileNameParts } from "../dateNotes/paths.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { decoratorName } from "../settings/calendarPage.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { firstDayOf, monthOf, weeksAroundGrid } from "./grid.ts";
import type { CivilMonth, MonthGrid } from "./grid.ts";
import { headerParts } from "./header.ts";
import { calendarModel } from "./model.ts";
import type { CalendarModel } from "./model.ts";
import { momentOf, monthShortName, weekdayShortNames } from "./obsidianHost.ts";
import type { NoteDotsReader } from "./obsidianHost.ts";
import { visibleNotes } from "./paths.ts";
import { agendaLists, agendaRows, agendaSections, selectedCellUse, selectedRange, visibleCellUse, weeksCovering } from "./agenda.ts";
import type { AgendaRow, AgendaScope, AgendaSection, SelectedDateNote } from "./agenda.ts";
import type { WeekRule } from "./weeks.ts";
import { ADJACENT_DIMS } from "./settings.ts";
import type { CalendarSettings } from "./settings.ts";

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
	sections: AgendaSection[];
	shownMonth: CivilMonth | undefined;
	paths: Set<string>;
}

export interface VisibleDates {
	models: readonly CalendarModel[];
	month: CivilMonth | undefined;
}

export function agendaOf(context: ScreenContext, scope: AgendaScope, visible: VisibleDates, selected: SelectedDateNote | undefined, hiddenLists: readonly string[]): Agenda {
	const { app, settings, rule, today } = context;
	const listed = agendaLists(settings.calendar.decorators)
		.map((dot) => dot.decoratorId)
		.filter((id) => !hiddenLists.includes(id));
	const nameOf = (path: string) => noteName(app, path);
	const sectionsOf = (rows: AgendaRow[], month: CivilMonth | undefined) => (month ? agendaSections(rows, month, settings.calendar.agendaMonthHeadings) : [{ month: undefined, rows }]);
	if (scope === "visible") return { sections: sectionsOf(agendaRows(visible.models, visibleCellUse, listed, nameOf), visible.month), shownMonth: visible.month, paths: new Set() };
	if (!selected) return { sections: [], shownMonth: undefined, paths: new Set() };
	const range = selectedRange(selected, rule);
	const grid = weeksAroundGrid(range.start, weeksCovering(range, rule), 0, rule, today);
	const { models, paths } = calendarModels(context, [grid], true);
	const month = monthOf(selected.date);
	return { sections: sectionsOf(agendaRows(models, selectedCellUse(selected, range), listed, nameOf), month), shownMonth: month, paths };
}

const DIMS_WITHOUT_NOTE_CLASS = "dims-without-note";
const ADJACENT_DIM_CLASS_PREFIX = "adjacent-dim-";

export function applyLook(root: HTMLElement, calendar: CalendarSettings): void {
	root.toggleClass(DIMS_WITHOUT_NOTE_CLASS, calendar.dimWithoutNote);
	for (const dim of ADJACENT_DIMS) root.toggleClass(`${ADJACENT_DIM_CLASS_PREFIX}${dim}`, dim === calendar.adjacentDim);
}

export function monthTitle(month: CivilMonth, shownMonth: CivilMonth | undefined): string {
	return momentOf(firstDayOf(month)).format(month.year === shownMonth?.year ? "MMMM" : "MMMM YYYY");
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
