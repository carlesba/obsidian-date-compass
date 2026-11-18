import type { Setting, SettingDefinitionItem, SettingDefinitionList } from "obsidian";
import { t } from "../i18n/index.ts";
import { addRibbonCommand, moveRibbonCommand, removeRibbonCommand, ribbonCommandsToAdd, ribbonEntries } from "../ribbon/buttons.ts";
import type { RibbonEntry, RibbonSource } from "../ribbon/buttons.ts";
import { PERIOD_LABELS } from "./dateNotesPage.ts";
import { leadWithListControls } from "./listRow.ts";

export interface RibbonChoice {
	value: string;
	name: string;
}

export interface RibbonListContext {
	listed: () => readonly string[];
	source: () => RibbonSource;
	appliesLive: () => boolean;
	change: (listed: string[]) => void;
	choose: (anchor: HTMLElement, choices: RibbonChoice[], pick: (id: string) => void) => void;
	notify: (message: string) => void;
}

export function ribbonEntryName(entry: RibbonEntry): string {
	return entry.name ?? t("ribbonDeletedCommand");
}

export function ribbonEntryWarning({ problem }: RibbonEntry): string | undefined {
	if (!problem) return undefined;
	if (problem.kind === "periodOff") return t("ribbonPeriodOff", { period: t(PERIOD_LABELS[problem.period]) });
	if (problem.kind === "incomplete") return t("ribbonCommandIncomplete", { reason: problem.reason });
	return t("ribbonCommandMissing");
}

export function ribbonButtonItems(context: RibbonListContext): SettingDefinitionItem[] {
	return [
		{
			type: "group",
			visible: () => !context.appliesLive(),
			items: [{ name: t("ribbonAppliesAfterReload"), desc: t("ribbonAppliesAfterReloadDesc") }],
		},
		ribbonButtonsList(context),
	];
}

function ribbonButtonsList(context: RibbonListContext): SettingDefinitionList {
	const listed = context.listed();
	const entryAt = (position: number): RibbonEntry => ribbonEntries(context.listed(), context.source())[position] ?? { id: listed[position], problem: { kind: "missing" } };
	return {
		type: "list",
		heading: t("ribbonButtons"),
		emptyState: t("noRibbonButtonsYet"),
		items: listed.map((_, position) => {
			const entry = entryAt(position);
			return {
				name: ribbonEntryName(entry),
				desc: ribbonEntryWarning(entry),
				render: (setting: Setting) => {
					const shown = entryAt(position);
					setting.setName(ribbonEntryName(shown));
					setting.setDesc(ribbonEntryWarning(shown) ?? "");
					return leadWithListControls(setting);
				},
			};
		}),
		onReorder: (from: number, to: number) => context.change(moveRibbonCommand(listed, from, to)),
		onDelete: (position: number) => context.change(removeRibbonCommand(listed, position)),
		addItem: {
			name: t("addRibbonButton"),
			action: (anchor: HTMLElement) => {
				const remaining = ribbonCommandsToAdd(context.listed(), context.source());
				if (remaining.length === 0) context.notify(t("everyRibbonCommandListed"));
				else context.choose(anchor, remaining.map(({ id, name }) => ({ value: id, name })), (id) => context.change(addRibbonCommand(context.listed(), id)));
			},
		},
	};
}
