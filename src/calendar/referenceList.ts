import { renderLabelWithDots } from "./cellDots.ts";
import type { ReferenceRow } from "./references.ts";

export interface ReferenceHandlers {
	open(notePath: string, event: MouseEvent): void;
	hover(notePath: string, event: MouseEvent, targetEl: HTMLElement): void;
}

export function renderReferences(parent: HTMLElement, rows: readonly ReferenceRow[], emptyText: string, nameOf: (path: string) => string, handlers: ReferenceHandlers): void {
	const listEl = parent.createDiv({ cls: "references" });
	if (rows.length === 0) {
		listEl.createDiv({ cls: "references-empty", text: emptyText });
		return;
	}
	for (const row of rows) {
		const rowEl = listEl.createDiv({ cls: "reference" });
		renderLabelWithDots(rowEl.createDiv({ cls: ["reference-date", ...row.labelClasses] }), row.label, [row.dot], false);
		const name = nameOf(row.notePath);
		const linkEl = rowEl.createEl("a", { cls: ["reference-note", "internal-link"], text: name, attr: { href: row.notePath, "data-href": row.notePath, title: name } });
		linkEl.addEventListener("click", (event) => {
			event.preventDefault();
			handlers.open(row.notePath, event);
		});
		linkEl.addEventListener("mouseover", (event) => handlers.hover(row.notePath, event, linkEl));
	}
}
