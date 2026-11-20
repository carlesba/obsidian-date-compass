import { setTooltip } from "obsidian";
import { renderLabelWithDots } from "./cellDots.ts";
import type { AgendaRow } from "./agenda.ts";

export interface AgendaHandlers {
	open(notePath: string, event: MouseEvent): void;
	hover(notePath: string, event: MouseEvent, targetEl: HTMLElement): void;
	dotName(decoratorId: string): string;
}

export function renderAgenda(parent: HTMLElement, rows: readonly AgendaRow[], emptyText: string, nameOf: (path: string) => string, handlers: AgendaHandlers): void {
	const listEl = parent.createDiv({ cls: "agenda" });
	if (rows.length === 0) {
		listEl.createDiv({ cls: "agenda-empty", text: emptyText });
		return;
	}
	for (const row of rows) {
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
}
