import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
import { t } from "../i18n/index.ts";
import type { RibbonButton } from "./buttons.ts";
import { arrangeInListOrder } from "./sync.ts";
import type { RibbonHost } from "./sync.ts";

interface RemovableRibbon {
	removeRibbonAction(id: string): void;
}

interface ArrangeableRibbon {
	items: { id: string }[];
	onChange(saveLayout: boolean): void;
}

interface CommandRunner {
	executeCommandById(id: string): unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isRemovableRibbon(ribbon: unknown): ribbon is RemovableRibbon {
	return isRecord(ribbon) && typeof ribbon.removeRibbonAction === "function";
}

function isArrangeableRibbon(ribbon: unknown): ribbon is ArrangeableRibbon {
	return isRecord(ribbon) && typeof ribbon.onChange === "function" && Array.isArray(ribbon.items) && ribbon.items.every((item) => isRecord(item) && typeof item.id === "string");
}

function isCommandRunner(commands: unknown): commands is CommandRunner {
	return isRecord(commands) && typeof commands.executeCommandById === "function";
}

export function createRibbonHost(plugin: Plugin): RibbonHost {
	const elements = new Map<string, HTMLElement>();
	const ribbon = (): unknown => (plugin.app.workspace as unknown as { leftRibbon?: unknown }).leftRibbon;
	const itemId = (button: RibbonButton) => `${plugin.manifest.id}:${button.title}`;
	const run = (button: RibbonButton) => {
		const commands: unknown = (plugin.app as unknown as { commands?: unknown }).commands;
		const ran = isCommandRunner(commands) && commands.executeCommandById(`${plugin.manifest.id}:${button.commandId}`) !== false;
		if (!ran) new Notice(t("ribbonCommandCannotRun", { name: button.title }));
	};
	return {
		appliesLive: () => isRemovableRibbon(ribbon()),
		add: (button) => {
			elements.set(button.title, plugin.addRibbonIcon(button.icon, button.title, () => run(button)));
		},
		remove: (button) => {
			const leftRibbon = ribbon();
			if (isRemovableRibbon(leftRibbon)) leftRibbon.removeRibbonAction(itemId(button));
			elements.get(button.title)?.detach();
			elements.delete(button.title);
		},
		arrange: (buttons) => {
			const leftRibbon = ribbon();
			if (!isArrangeableRibbon(leftRibbon)) return;
			arrangeInListOrder(leftRibbon.items, buttons.map(itemId));
			leftRibbon.onChange(false);
		},
		askForReload: () => new Notice(t("ribbonReloadNotice")),
	};
}
