import type { RibbonButton } from "./buttons.ts";

export interface RibbonHost {
	appliesLive(): boolean;
	add(button: RibbonButton): void;
	remove(button: RibbonButton): void;
	arrange(buttons: readonly RibbonButton[]): void;
	askForReload(): void;
}

function sameButtons(left: readonly RibbonButton[], right: readonly RibbonButton[]): boolean {
	return left.length === right.length && left.every((button, index) => button.commandId === right[index].commandId && button.title === right[index].title && button.icon === right[index].icon);
}

export function arrangeInListOrder<Item extends { id: string }>(items: Item[], ids: readonly string[]): void {
	const slots = items.flatMap((item, index) => (ids.includes(item.id) ? [index] : []));
	const inListOrder = ids.flatMap((id) => items.filter((item) => item.id === id).slice(0, 1));
	if (slots.length !== inListOrder.length) return;
	slots.forEach((slot, position) => {
		items[slot] = inListOrder[position];
	});
}

export class RibbonButtons {
	private shown: RibbonButton[] | undefined;
	private awaitingReload: RibbonButton[] | undefined;
	private readonly host: RibbonHost;

	constructor(host: RibbonHost) {
		this.host = host;
	}

	sync(buttons: readonly RibbonButton[]): void {
		if (this.shown && sameButtons(this.shown, buttons)) {
			this.awaitingReload = undefined;
			return;
		}
		if (this.shown && !this.host.appliesLive()) {
			if (this.awaitingReload && sameButtons(this.awaitingReload, buttons)) return;
			this.awaitingReload = [...buttons];
			this.host.askForReload();
			return;
		}
		for (const button of this.shown ?? []) this.host.remove(button);
		for (const button of buttons) this.host.add(button);
		this.host.arrange(buttons);
		this.shown = [...buttons];
	}
}
