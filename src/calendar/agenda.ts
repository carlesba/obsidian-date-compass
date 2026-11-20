import type { Period } from "../dateNotes/periods.ts";
import { addDays, daysBetween, isoDate } from "../parse/calendar.ts";
import type { CivilDate } from "../parse/calendar.ts";
import { dayRange, headerRange } from "./dateProperties.ts";
import type { DateRange } from "./dateProperties.ts";
import type { Dot } from "./decorators.ts";
import { monthOf, weekStartOf } from "./grid.ts";
import { CLICKABLE_CLASS, dayClasses, titlePartClasses, weekClasses } from "./model.ts";
import type { CalendarModel, NoteCell } from "./model.ts";
import type { CivilMonth } from "./grid.ts";
import type { WeekRule } from "./weeks.ts";

export const AGENDA_MODES = ["off", "selected", "visible"] as const;
export type AgendaMode = (typeof AGENDA_MODES)[number];

export const AGENDA_SCOPES = ["selected", "visible"] as const;
export type AgendaScope = (typeof AGENDA_SCOPES)[number];

export type CellKind = Period;

export interface AgendaRow {
	kind: CellKind;
	label: string;
	labelClasses: string[];
	startsOn: CivilDate;
	cell: NoteCell;
	dot: Dot;
	notePath: string;
}

export interface SelectedDateNote {
	period: Period;
	date: CivilDate;
	path: string;
}

export type CellUse = "all" | "links" | "none";

export type CellUseOf = (cell: NoteCell, kind: CellKind) => CellUse;

const LABEL_CLASSES_LEFT_OUT = [CLICKABLE_CLASS, "active"];

const KIND_ORDER: readonly CellKind[] = ["day", "week", "month", "quarter", "year"];
const DAYS_IN_WEEK = 7;

export function visibleCellUse(_cell: NoteCell, kind: CellKind): CellUse {
	return kind === "day" ? "all" : "links";
}

export interface AgendaSection {
	month: CivilMonth | undefined;
	rows: AgendaRow[];
}

export function agendaSections(rows: readonly AgendaRow[], shownMonth: CivilMonth, monthHeadings: boolean): AgendaSection[] {
	const sections: AgendaSection[] = [];
	for (const row of rows) {
		const month = monthOf(row.startsOn);
		const last = sections[sections.length - 1];
		if (last && (!monthHeadings || sameMonth(last.month ?? shownMonth, month))) {
			last.rows.push(row);
			continue;
		}
		sections.push({ month: monthHeadings && (last || !sameMonth(month, shownMonth)) ? month : undefined, rows: [row] });
	}
	return sections;
}

function sameMonth(one: CivilMonth, other: CivilMonth): boolean {
	return one.year === other.year && one.month === other.month;
}

export function selectedCellUse(selected: SelectedDateNote, range: DateRange): CellUseOf {
	return (cell, kind) => {
		const { target } = cell;
		if (!target) return "none";
		if (kind === "day" && withinRange(target.date, range)) return "all";
		return target.path === selected.path ? "links" : "none";
	};
}

export function selectedRange(selected: SelectedDateNote, rule: WeekRule): DateRange {
	switch (selected.period) {
		case "day":
			return dayRange(selected.date);
		case "week": {
			const start = weekStartOf(selected.date, rule);
			return { start, end: addDays(start, DAYS_IN_WEEK - 1) };
		}
		default:
			return headerRange(selected.period, monthOf(selected.date));
	}
}

export function weeksCovering(range: DateRange, rule: WeekRule): number {
	return Math.ceil((daysBetween(weekStartOf(range.start, rule), range.end) + 1) / DAYS_IN_WEEK);
}

function withinRange(date: CivilDate, range: DateRange): boolean {
	return daysBetween(range.start, date) >= 0 && daysBetween(date, range.end) >= 0;
}

export function agendaRows(
	models: readonly CalendarModel[],
	useOf: CellUseOf,
	listedDecorators: readonly string[],
	nameOf: (path: string) => string,
): AgendaRow[] {
	const rows = new Map<string, AgendaRow>();
	const add = (cell: NoteCell, kind: CellKind, label: string, classes: string[], startsOn?: CivilDate) => {
		const use = useOf(cell, kind);
		if (use === "none" || !cell.target) return;
		for (const { dot, notePath } of cell.references) {
			if (!listedDecorators.includes(dot.decoratorId) || (dot.source !== "links" && use !== "all")) continue;
			const key = `${cell.target.path}\n${dot.decoratorId}\n${notePath}`;
			const labelClasses = classes.filter((name) => !LABEL_CLASSES_LEFT_OUT.includes(name));
			if (!rows.has(key)) rows.set(key, { kind, label, labelClasses, startsOn: startsOn ?? cell.target.date, cell, dot, notePath });
		}
	};
	for (const model of models) {
		for (const part of model.title) add(part, part.period, part.label, titlePartClasses(part));
		for (const row of model.rows) {
			if (row.week) add(row.week, "week", row.week.label, weekClasses(row.week), row.days[0]?.target?.date);
			for (const day of row.days) add(day, "day", day.label, dayClasses(day));
		}
	}
	const sortKey = (row: AgendaRow): [string, number, number, string] => [
		isoDate(row.startsOn),
		KIND_ORDER.indexOf(row.kind),
		listedDecorators.indexOf(row.dot.decoratorId),
		nameOf(row.notePath).toLowerCase(),
	];
	return [...rows.values()].sort((one, other) => compareKeys(sortKey(one), sortKey(other)));
}

function compareKeys(one: readonly (string | number)[], other: readonly (string | number)[]): number {
	for (let index = 0; index < one.length; index++) {
		const [left, right] = [one[index], other[index]];
		if (left < right) return -1;
		if (left > right) return 1;
	}
	return 0;
}

