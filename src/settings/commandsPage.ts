import type { SettingDefinitionList, SettingDefinitionRender } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { commandName, commandWarning, newCommand } from "../commands/settings.ts";
import type { AskKind, CommandDestination, DateCommand, WriteMode } from "../commands/settings.ts";
import type { LinkStyleField } from "../insertion/linkStyle.ts";
import { commandKey, commandKeyPrefix } from "./controlKeys.ts";
import { moveEntry } from "./entryList.ts";
import { linkStyleItems } from "./linkStylePage.ts";
import type { LinkStyleHost } from "./linkStylePage.ts";
import type { IdentifiedPage } from "./pages.ts";
import { LIST_ROW_EDIT_CLASS, leadWithListControls } from "./listRow.ts";
import { ribbonButtonItems } from "./ribbonList.ts";
import type { RibbonListContext } from "./ribbonList.ts";

export interface CommandsPageContext extends LinkStyleHost {
	commands: () => DateCommand[];
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => Promise<void>;
	ribbon: RibbonListContext;
}

export const COMMANDS_PAGE_ID = "commands";

export const ASK_LABELS: Record<AskKind, TranslationKey> = {
	date: "askOneDate",
	dates: "askDates",
};

export const MODE_LABELS: Record<WriteMode, TranslationKey> = {
	add: "modeAdd",
	replace: "modeReplace",
};

export const DESTINATION_LABELS: Record<CommandDestination, TranslationKey> = {
	property: "destinationProperty",
	cursor: "destinationCursor",
};

const LINK_STYLE_FIELDS_BY_DESTINATION: Record<CommandDestination, readonly LinkStyleField[]> = {
	property: ["targets", "linkPath", "aliasShape", "aliasFormat"],
	cursor: ["targets", "template", "linkPath", "separator", "aliasShape", "aliasFormat"],
};

const SUMMARIES: Record<WriteMode, TranslationKey> = {
	add: "commandSummaryAdd",
	replace: "commandSummary",
};

export function commandPageId(command: DateCommand): string {
	return `command-${command.id}`;
}

export function commandsPage(context: CommandsPageContext): IdentifiedPage {
	const commands = context.commands();
	return {
		type: "page",
		id: COMMANDS_PAGE_ID,
		name: t("commandsSection"),
		desc: t("commandsSectionDesc"),
		items: [commandsList(commands, context), { type: "group", visible: false, items: commands.map((command) => commandPage(command, context)) }, ...ribbonButtonItems(context.ribbon)],
	};
}

function commandsList(commands: DateCommand[], context: CommandsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("commandsList"),
		emptyState: t("noCommandsYet"),
		items: commands.map((command) => commandRow(command, context)),
		onReorder: (from, to) => void context.change(() => moveEntry(commands, from, to)),
		onDelete: (index) => void context.change(() => commands.splice(index, 1)),
		addItem: {
			name: t("addCommand"),
			action: () => {
				const command = newCommand(commands);
				void context.change(() => commands.push(command)).then(() => context.openPage(commandPageId(command)));
			},
		},
	};
}

export function commandSummary(command: DateCommand): string {
	const asks = t(ASK_LABELS[command.asks]);
	if (command.destination === "cursor") return t("commandSummaryCursor", { asks });
	return t(SUMMARIES[command.mode], { property: command.property.trim(), asks });
}

function commandRow(command: DateCommand, context: CommandsPageContext): SettingDefinitionRender {
	return {
		name: commandName(command),
		desc: commandWarning(command) ?? commandSummary(command),
		render: (setting) => {
			setting.setName(commandName(command));
			setting.setDesc(commandWarning(command) ?? commandSummary(command));
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editCommand"))
					.onClick(() => context.openPage(commandPageId(command)))
					.extraSettingsEl.addClass(LIST_ROW_EDIT_CLASS),
			);
			return leadWithListControls(setting);
		},
	};
}

function commandPage(command: DateCommand, context: CommandsPageContext): IdentifiedPage {
	const writesToProperty = command.destination === "property";
	return {
		type: "page",
		id: commandPageId(command),
		get name() {
			return commandName(command);
		},
		status: () => (commandWarning(command) ? "warning" : null),
		items: [
			{
				type: "group",
				items: [
					{ name: t("commandName"), desc: t("commandNameDesc"), control: { type: "text", key: commandKey(command.id, "name"), placeholder: t("untitledCommand") } },
					{ name: t("commandDestination"), desc: t("commandDestinationDesc"), control: { type: "dropdown", key: commandKey(command.id, "destination"), options: translatedLabels(DESTINATION_LABELS) } },
					...(writesToProperty
						? [
								{ name: t("commandProperty"), desc: t("commandPropertyDesc"), control: { type: "text" as const, key: commandKey(command.id, "property"), placeholder: "dates" } },
								{ name: t("commandMode"), desc: t("commandModeDesc"), control: { type: "dropdown" as const, key: commandKey(command.id, "mode"), options: translatedLabels(MODE_LABELS) } },
							]
						: []),
					{ name: t("commandAsks"), desc: t("commandAsksDesc"), control: { type: "dropdown", key: commandKey(command.id, "asks"), options: translatedLabels(ASK_LABELS) } },
					{ name: t("commandLink"), desc: t("commandLinkDesc"), control: { type: "toggle", key: commandKey(command.id, "link") } },
				],
			},
			...linkStyleItems({ keyPrefix: commandKeyPrefix(command.id), style: () => command, host: context, fields: LINK_STYLE_FIELDS_BY_DESTINATION[command.destination] }),
		],
	};
}
