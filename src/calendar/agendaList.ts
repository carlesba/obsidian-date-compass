import { setTooltip } from "obsidian";
import { renderLabelWithDots } from "./cellDots.ts";
import type { AgendaRow, AgendaSection } from "./agenda.ts";
import type { CivilMonth } from "./grid.ts";

export interface AgendaHandlers {
	open(notePath: string, event: MouseEvent): void;
	hover(notePath: string, event: MouseEvent, targetEl: HTMLElement): void;
	dotName(decoratorId: string): string;
	monthTitle(month: CivilMonth): string;
}

export function renderAgenda(parent: HTMLElement, sections: readonly AgendaSection[], emptyText: string, nameOf: (path: string) => string, handlers: AgendaHandlers): void {
	const listEl = parent.createDiv({ cls: "agenda" });
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
