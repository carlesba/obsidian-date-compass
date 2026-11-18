import type { Setting } from "obsidian";

export const LIST_ROW_CLASS = "date-compass-list-row";

export const LIST_ROW_EDIT_CLASS = "date-compass-list-row-edit";

const DRAG_HANDLE_CLASS = "mod-drag-handle";

export function leadWithListControls(setting: Setting): () => void {
	setting.settingEl.addClass(LIST_ROW_CLASS);
	let leading: Element[] = [];
	let tornDown = false;
	queueMicrotask(() => {
		if (tornDown) return;
		leading = [DRAG_HANDLE_CLASS, LIST_ROW_EDIT_CLASS]
			.map((className) => setting.controlEl.querySelector(`.${className}`))
			.filter((element): element is Element => element !== null);
		setting.settingEl.prepend(...leading);
	});
	return () => {
		tornDown = true;
		leading.forEach((element) => element.remove());
	};
}
