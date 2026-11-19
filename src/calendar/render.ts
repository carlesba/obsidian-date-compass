import { Platform, setIcon } from "obsidian";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { renderLabelWithDots } from "./cellDots.ts";
import { dayClasses, titlePartClasses, weekClasses } from "./model.ts";
import type { CalendarModel, CalendarScreen, NavigationStep, NoteCell, NoteTarget } from "./model.ts";

export interface CalendarHandlers {
	back(): void;
	forward(): void;
	jumpBack(): void;
	jumpForward(): void;
	today(): void;
	open(target: NoteTarget, event: MouseEvent): void;
	hover(target: NoteTarget, event: MouseEvent, targetEl: HTMLElement): void;
	contextMenu(target: NoteTarget, event: MouseEvent): void;
}

interface Arrow {
	icon: string;
	label: TranslationKey;
	move: (handlers: CalendarHandlers) => void;
}

const STEP_ICON = "chevron-left";
const JUMP_ICON = "chevrons-left";
const WEEK_CELL_CLASS = "week-num-cell";

const ARROWS: Record<NavigationStep, { before: Arrow[]; after: Arrow[] }> = {
	month: {
		before: [{ icon: STEP_ICON, label: "calendarPreviousMonth", move: (handlers) => handlers.back() }],
		after: [{ icon: STEP_ICON, label: "calendarNextMonth", move: (handlers) => handlers.forward() }],
	},
	week: {
		before: [
			{ icon: JUMP_ICON, label: "calendarStartOfMonth", move: (handlers) => handlers.jumpBack() },
			{ icon: STEP_ICON, label: "calendarPreviousWeek", move: (handlers) => handlers.back() },
		],
		after: [
			{ icon: STEP_ICON, label: "calendarNextWeek", move: (handlers) => handlers.forward() },
			{ icon: JUMP_ICON, label: "calendarStartOfNextMonth", move: (handlers) => handlers.jumpForward() },
		],
	},
};

export function renderCalendar(root: HTMLElement, screen: CalendarScreen, handlers: CalendarHandlers): void {
	const [first] = screen.months;
	if (!first) return;
	renderNav(root, first, screen.step, handlers);
	renderTable(root, screen.months, handlers);
}

function renderNav(root: HTMLElement, model: CalendarModel, step: NavigationStep, handlers: CalendarHandlers): void {
	const nav = root.createDiv({ cls: "nav" });
	renderTitle(nav.createEl("h3", { cls: "title" }), model, handlers);
	const rightNav = nav.createDiv({ cls: "right-nav" });
	const arrows = ARROWS[step];
	for (const arrow of arrows.before) renderArrow(rightNav, arrow, false, handlers);
	rightNav.createDiv({ cls: "reset-button", text: t("calendarToday"), attr: Platform.isMobile ? { "aria-label": t("calendarToday") } : {} }).addEventListener("click", () => handlers.today());
	for (const arrow of arrows.after) renderArrow(rightNav, arrow, true, handlers);
}

function renderTitle(titleEl: HTMLElement, model: CalendarModel, handlers: CalendarHandlers): void {
	model.title.forEach((part, index) => {
		if (index > 0) titleEl.appendText(" ");
		const partEl = titleEl.createSpan({ cls: titlePartClasses(part) });
		renderLabelWithDots(partEl, part.label, part.dots, false);
		bindNote(partEl, part, handlers);
	});
}

function renderArrow(parent: HTMLElement, arrow: Arrow, pointsForward: boolean, handlers: CalendarHandlers): void {
	const arrowEl = parent.createDiv({ cls: pointsForward ? ["arrow", "right"] : ["arrow"], attr: { "aria-label": t(arrow.label) } });
	setIcon(arrowEl, arrow.icon);
	arrowEl.addEventListener("click", () => arrow.move(handlers));
}

function renderTable(root: HTMLElement, months: readonly CalendarModel[], handlers: CalendarHandlers): void {
	const [first] = months;
	const table = root.createEl("table", { cls: "calendar" });
	const columns = table.createEl("colgroup");
	const headings = table.createEl("thead").createEl("tr");
	if (first.showsWeekColumn) {
		columns.createEl("col");
		headings.createEl("th", { text: t("calendarWeekColumn") });
	}
	for (const weekday of first.weekdays) {
		columns.createEl("col", { cls: weekday.weekend ? "weekend" : undefined });
		headings.createEl("th", { text: weekday.label });
	}
	const columnCount = first.weekdays.length + (first.showsWeekColumn ? 1 : 0);
	months.forEach((model, index) => {
		const body = table.createEl("tbody");
		if (index > 0) renderTitle(body.createEl("tr", { cls: "month-heading" }).createEl("td", { attr: { colspan: columnCount } }).createDiv({ cls: "title" }), model, handlers);
		for (const row of model.rows) {
			const tableRow = body.createEl("tr");
			if (row.week) renderCell(tableRow.createEl("td", { cls: WEEK_CELL_CLASS }), weekClasses(row.week), row.week.label, row.week, model.showsDotsAbove, handlers);
			for (const day of row.days) renderCell(tableRow.createEl("td"), dayClasses(day), day.label, day, model.showsDotsAbove, handlers);
		}
	});
}

function renderCell(tableCell: HTMLElement, classes: string[], label: string, cell: NoteCell, showsDotsAbove: boolean, handlers: CalendarHandlers): void {
	const cellEl = tableCell.createDiv({ cls: classes });
	renderLabelWithDots(cellEl, label, cell.dots, showsDotsAbove);
	bindNote(cellEl, cell, handlers);
}

function bindNote(noteEl: HTMLElement, cell: NoteCell, handlers: CalendarHandlers): void {
	const { target } = cell;
	if (!target) return;
	noteEl.addEventListener("click", (event) => handlers.open(target, event));
	if (!cell.hasNote) return;
	noteEl.addEventListener("mouseover", (event) => handlers.hover(target, event, noteEl));
	noteEl.addEventListener("contextmenu", (event) => handlers.contextMenu(target, event));
}
