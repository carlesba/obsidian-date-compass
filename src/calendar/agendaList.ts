import { setTooltip } from "obsidian";
import { renderLabelWithDots } from "./cellDots.ts";
import type { AgendaRow, AgendaSection } from "./agenda.ts";
import type { Dot } from "./decorators.ts";
import type { CivilMonth } from "./grid.ts";

export interface AgendaHandlers {
	open(notePath: string, event: MouseEvent): void;
	hover(notePath: string, event: MouseEvent, targetEl: HTMLElement): void;
	dotName(decoratorId: string): string;
	monthTitle(month: CivilMonth): string;
}

export interface AgendaFilter {
	lists: readonly Dot[];
	hidden: readonly string[];
	toggle(decoratorId: string): void;
}

export function renderAgenda(
	parent: HTMLElement,
	sections: readonly AgendaSection[],
	emptyText: string,
	nameOf: (path: string) => string,
	handlers: AgendaHandlers,
	filter: AgendaFilter | undefined,
): void {
	const listEl = parent.createDiv({ cls: "agenda" });
	if (filter && filter.lists.length > 0) renderFilter(listEl, filter, handlers);
	if (sections.every((section) => section.rows.length === 0)) {
		listEl.createDiv({ cls: "agenda-empty", text: emptyText });
		return;
	}
	for (const { month, rows } of sections) {
		if (month) listEl.createDiv({ cls: "agenda-month", text: handlers.monthTitle(month) });
		for (const row of rows) renderRow(listEl, row, nameOf, handlers);
	}
}

function renderRow(listEl: HTMLElement, row: AgendaRow, nameOf: (path: string) => string, handlers: AgendaHandlers): void {
	const rowEl = listEl.createDiv({ cls: "agenda-row" });
	const dateEl = rowEl.createDiv({ cls: ["agenda-date", ...row.labelClasses] });
	renderLabelWithDots(dateEl, row.label, [row.dot], false);
	setTooltip(dateEl, handlers.dotName(row.dot.decoratorId));
	const name = nameOf(row.notePath);
	const linkEl = rowEl.createEl("a", { cls: ["agenda-note", "internal-link"], text: name, attr: { href: row.notePath, "data-href": row.notePath, title: name } });
	linkEl.addEventListener("click", (event) => {
		event.preventDefault();
		handlers.open(row.notePath, event);
	});
	linkEl.addEventListener("mouseover", (event) => handlers.hover(row.notePath, event, linkEl));
}

function renderFilter(listEl: HTMLElement, filter: AgendaFilter, handlers: AgendaHandlers): void {
	const filterEl = listEl.createDiv({ cls: "agenda-filter" });
	for (const dot of filter.lists) {
		const shown = !filter.hidden.includes(dot.decoratorId);
		const button = filterEl.createEl("button", { cls: shown ? "agenda-filter-list" : ["agenda-filter-list", "is-hidden"], attr: { "aria-pressed": String(shown) } });
		renderLabelWithDots(button.createDiv({ cls: "agenda-filter-mark" }), "", [dot], false);
		setTooltip(button, handlers.dotName(dot.decoratorId));
		button.addEventListener("click", () => filter.toggle(dot.decoratorId));
	}
}
