import { setIcon } from "obsidian";
import { t } from "../i18n/index.ts";
import type { Dot } from "./dots.ts";
import { dayClasses, titlePartClasses, weekClasses } from "./model.ts";
import type { CalendarModel, NoteCell, NoteTarget } from "./model.ts";

export interface CalendarHandlers {
	previousMonth(): void;
	nextMonth(): void;
	currentMonth(): void;
	open(target: NoteTarget, event: MouseEvent): void;
	hover(target: NoteTarget, event: MouseEvent, targetEl: HTMLElement): void;
	contextMenu(target: NoteTarget, event: MouseEvent): void;
}

const ARROW_ICON = "chevron-left";
const DOT_VIEW_BOX = "0 0 6 6";
const DOT_CIRCLE = { cx: 3, cy: 3, r: 2 };

export function renderCalendar(root: HTMLElement, model: CalendarModel, handlers: CalendarHandlers): void {
	renderNav(root, model, handlers);
	renderTable(root, model, handlers);
}

function renderNav(root: HTMLElement, model: CalendarModel, handlers: CalendarHandlers): void {
	const nav = root.createDiv({ cls: "nav" });
	const title = nav.createEl("h3", { cls: "title" });
	model.title.forEach((part, index) => {
		if (index > 0) title.appendText(" ");
		bindNote(title.createSpan({ cls: titlePartClasses(part), text: part.label }), part, handlers);
	});
	const rightNav = nav.createDiv({ cls: "right-nav" });
	renderArrow(rightNav, ["arrow"], t("calendarPreviousMonth"), () => handlers.previousMonth());
	rightNav.createDiv({ cls: "reset-button", text: t("calendarToday") }).addEventListener("click", () => handlers.currentMonth());
	renderArrow(rightNav, ["arrow", "right"], t("calendarNextMonth"), () => handlers.nextMonth());
}

function renderArrow(parent: HTMLElement, classes: string[], label: string, move: () => void): void {
	const arrow = parent.createDiv({ cls: classes, attr: { "aria-label": label } });
	setIcon(arrow, ARROW_ICON);
	arrow.addEventListener("click", move);
}

function renderTable(root: HTMLElement, model: CalendarModel, handlers: CalendarHandlers): void {
	const table = root.createEl("table", { cls: "calendar" });
	const columns = table.createEl("colgroup");
	const headings = table.createEl("thead").createEl("tr");
	if (model.showsWeekColumn) {
		columns.createEl("col");
		headings.createEl("th", { text: t("calendarWeekColumn") });
	}
	for (const weekday of model.weekdays) {
		columns.createEl("col", { cls: weekday.weekend ? "weekend" : undefined });
		headings.createEl("th", { text: weekday.label });
	}
	const body = table.createEl("tbody");
	for (const row of model.rows) {
		const tableRow = body.createEl("tr");
		if (row.week) renderCell(tableRow, weekClasses(row.week), row.week.label, row.week, handlers);
		for (const day of row.days) renderCell(tableRow, dayClasses(day), day.label, day, handlers);
	}
}

function renderCell(tableRow: HTMLElement, classes: string[], label: string, cell: NoteCell, handlers: CalendarHandlers): void {
	const cellEl = tableRow.createEl("td").createDiv({ cls: classes, text: label });
	renderDots(cellEl.createDiv({ cls: "dot-container" }), cell.dots);
	bindNote(cellEl, cell, handlers);
}

function renderDots(container: HTMLElement, dots: readonly Dot[]): void {
	for (const dot of dots) {
		container
			.createSvg("svg", { cls: ["dot", dot.filled ? "filled" : "hollow"], attr: { viewBox: DOT_VIEW_BOX } })
			.createSvg("circle", { attr: DOT_CIRCLE });
	}
}

function bindNote(noteEl: HTMLElement, cell: NoteCell, handlers: CalendarHandlers): void {
	const { target } = cell;
	if (!target) return;
	noteEl.addEventListener("click", (event) => handlers.open(target, event));
	if (!cell.hasNote) return;
	noteEl.addEventListener("mouseover", (event) => handlers.hover(target, event, noteEl));
	noteEl.addEventListener("contextmenu", (event) => handlers.contextMenu(target, event));
}
