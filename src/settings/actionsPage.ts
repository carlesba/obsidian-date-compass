import type { SettingDefinitionList, SettingDefinitionRender } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { actionName, actionWarning, moveEntry, newAction } from "../actions/settings.ts";
import type { AskKind, DateAction, WriteMode } from "../actions/settings.ts";
import { actionKey } from "./controlKeys.ts";
import type { IdentifiedPage } from "./pages.ts";

export interface ActionsPageContext {
	actions: () => DateAction[];
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => Promise<void>;
}

export const ACTIONS_PAGE_ID = "actions";

export const ASK_LABELS: Record<AskKind, TranslationKey> = {
	date: "askOneDate",
	dates: "askDates",
};

export const MODE_LABELS: Record<WriteMode, TranslationKey> = {
	add: "modeAdd",
	replace: "modeReplace",
};

const SUMMARIES: Record<WriteMode, TranslationKey> = {
	add: "actionSummaryAdd",
	replace: "actionSummary",
};

export function actionPageId(action: DateAction): string {
	return `action-${action.id}`;
}

export function actionsPage(context: ActionsPageContext): IdentifiedPage {
	const actions = context.actions();
	return {
		type: "page",
		id: ACTIONS_PAGE_ID,
		name: t("actionsSection"),
		desc: t("actionsSectionDesc"),
		items: [actionsList(actions, context), { type: "group", visible: false, items: actions.map((action) => actionPage(action)) }],
	};
}

function actionsList(actions: DateAction[], context: ActionsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("actionsList"),
		emptyState: t("noActionsYet"),
		items: actions.map((action) => actionRow(action, context)),
		onReorder: (from, to) => void context.change(() => moveEntry(actions, from, to)),
		onDelete: (index) => void context.change(() => actions.splice(index, 1)),
		addItem: {
			name: t("addAction"),
			action: () => {
				const action = newAction(actions);
				void context.change(() => actions.push(action)).then(() => context.openPage(actionPageId(action)));
			},
		},
	};
}

export function actionSummary(action: DateAction): string {
	const property = action.property.trim();
	return t(SUMMARIES[action.mode], { property, asks: t(ASK_LABELS[action.asks]) });
}

function actionRow(action: DateAction, context: ActionsPageContext): SettingDefinitionRender {
	return {
		name: actionName(action),
		desc: actionWarning(action) ?? actionSummary(action),
		render: (setting) => {
			setting.setName(actionName(action));
			setting.setDesc(actionWarning(action) ?? actionSummary(action));
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editAction"))
					.onClick(() => context.openPage(actionPageId(action))),
			);
		},
	};
}

function actionPage(action: DateAction): IdentifiedPage {
	return {
		type: "page",
		id: actionPageId(action),
		get name() {
			return actionName(action);
		},
		status: () => (actionWarning(action) ? "warning" : null),
		items: [
			{
				type: "group",
				items: [
					{ name: t("actionName"), desc: t("actionNameDesc"), control: { type: "text", key: actionKey(action.id, "name"), placeholder: t("untitledAction") } },
					{ name: t("actionProperty"), desc: t("actionPropertyDesc"), control: { type: "text", key: actionKey(action.id, "property"), placeholder: "dates" } },
					{ name: t("actionMode"), desc: t("actionModeDesc"), control: { type: "dropdown", key: actionKey(action.id, "mode"), options: translatedLabels(MODE_LABELS) } },
					{ name: t("actionAsks"), desc: t("actionAsksDesc"), control: { type: "dropdown", key: actionKey(action.id, "asks"), options: translatedLabels(ASK_LABELS) } },
					{ name: t("actionLink"), desc: t("actionLinkDesc"), control: { type: "toggle", key: actionKey(action.id, "link") } },
				],
			},
		],
	};
}
