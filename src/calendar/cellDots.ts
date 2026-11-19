import type { Dot, DotPosition } from "./decorators.ts";
import { dotClasses } from "./model.ts";

const DOT_VIEW_BOX = "0 0 6 6";
const DOT_CIRCLE = { cx: 3, cy: 3, r: 2 };
const CORNER_CLASSES: Record<string, string> = { topLeft: "top-left", topRight: "top-right" };
const CORNER_POSITIONS: readonly DotPosition[] = ["topLeft", "topRight"];

export function renderLabelWithDots(labelEl: HTMLElement, label: string, dots: readonly Dot[], reservesDotsAbove: boolean): void {
	const dotsAt = (position: DotPosition) => dots.filter((dot) => dot.position === position);
	const above = dotsAt("above");
	if (reservesDotsAbove || above.length > 0) renderDots(labelEl.createDiv({ cls: ["dot-container", "dot-above"] }), above);
	labelEl.appendText(label);
	renderDots(labelEl.createDiv({ cls: ["dot-container", "dot-below"] }), dotsAt("below"));
	for (const corner of CORNER_POSITIONS) {
		const cornerDots = dotsAt(corner);
		if (cornerDots.length > 0) renderDots(labelEl.createDiv({ cls: ["dot-container", "dot-corner", CORNER_CLASSES[corner]] }), cornerDots);
	}
}

function renderDots(container: HTMLElement, dots: readonly Dot[]): void {
	for (const dot of dots) {
		container.createSvg("svg", { cls: dotClasses(dot), attr: { viewBox: DOT_VIEW_BOX } }).createSvg("circle", { attr: DOT_CIRCLE });
	}
}
