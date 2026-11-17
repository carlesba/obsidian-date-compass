import type { SettingDefinitionGroup, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionRender } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import {
	ALWAYS,
	actionName,
	actionWarning,
	asksForNotes,
	inputName,
	inputOf,
	moveEntry,
	newAction,
	newInput,
	newWrite,
	writeWarning,
} from "../actions/settings.ts";
import type { ActionInput, ActionWrite, DateAction, InputType, PropertyMode, ValueFormat, WriteTarget, WriteValue } from "../actions/settings.ts";
import { actionKey, inputKey, writeKey } from "./controlKeys.ts";
import type { IdentifiedPage } from "./pages.ts";

export interface ActionsPageContext {
	actions: () => DateAction[];
	write: (key: string, value: unknown) => void;
	openPage: (pageId: string) => void;
	change: (mutate: () => unknown) => void;
}

export const ACTIONS_PAGE_ID = "actions";

export const INPUT_TYPE_LABELS: Record<InputType, TranslationKey> = {
	date: "inputTypeDate",
	dates: "inputTypeDates",
	periodicNote: "inputTypePeriodicNote",
	yesNo: "inputTypeYesNo",
};

const TARGET_LABELS: Record<WriteTarget, TranslationKey> = {
	property: "writeTargetProperty",
	body: "writeTargetBody",
};

const VALUE_LABELS: Record<WriteValue, TranslationKey> = {
	links: "writeValueLinks",
	first: "writeValueFirst",
	last: "writeValueLast",
};

const FORMAT_LABELS: Record<ValueFormat, TranslationKey> = {
	link: "valueFormatLink",
	dateText: "valueFormatDateText",
};

const MODE_LABELS: Record<PropertyMode, TranslationKey> = {
	append: "propertyModeAppend",
	dedupeSort: "propertyModeDedupeSort",
	replace: "propertyModeReplace",
};

export function actionPageId(action: DateAction): string {
	return `action-${action.id}`;
}

export function inputPageId(action: DateAction, input: ActionInput): string {
	return `action-${action.id}-input-${input.id}`;
}

export function writePageId(action: DateAction, write: ActionWrite): string {
	return `action-${action.id}-write-${write.id}`;
}

export function actionsPage(context: ActionsPageContext): IdentifiedPage {
	const actions = context.actions();
	return {
		type: "page",
		id: ACTIONS_PAGE_ID,
		name: t("actionsSection"),
		desc: t("actionsSectionDesc"),
		items: [actionsList(actions, context), { type: "group", visible: false, items: actions.map((action) => actionPage(action, context)) }],
	};
}

function actionsList(actions: DateAction[], context: ActionsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("actionsList"),
		emptyState: t("noActionsYet"),
		items: actions.map((action) => actionRow(action, context)),
		onReorder: (from, to) => context.change(() => moveEntry(actions, from, to)),
		onDelete: (index) => context.change(() => actions.splice(index, 1)),
		addItem: {
			name: t("addAction"),
			action: () => {
				const action = newAction(actions);
				context.change(() => actions.push(action));
				context.openPage(actionPageId(action));
			},
		},
	};
}

export function actionSummary(action: DateAction): string {
	const asks = action.inputs.map(inputName).join(", ");
	const writes = action.writes.map(writeName).join(", ");
	return t("actionSummary", { asks: asks === "" ? t("nothing") : asks, writes: writes === "" ? t("nothing") : writes });
}

function actionRow(action: DateAction, context: ActionsPageContext): SettingDefinitionRender {
	return {
		name: actionName(action),
		desc: actionWarning(action) ?? actionSummary(action),
		render: (setting) => {
			setting.setName(actionName(action));
			setting.setDesc(actionWarning(action) ?? actionSummary(action));
			setting.addToggle((toggle) =>
				toggle
					.setTooltip(t("offerActionAsCommand"))
					.setValue(action.enabled)
					.onChange((enabled) => context.write(actionKey(action.id, "enabled"), enabled)),
			);
			setting.addExtraButton((button) =>
				button
					.setIcon("pencil")
					.setTooltip(t("editAction"))
					.onClick(() => context.openPage(actionPageId(action))),
			);
		},
	};
}

function actionPage(action: DateAction, context: ActionsPageContext): IdentifiedPage {
	return {
		type: "page",
		id: actionPageId(action),
		get name() {
			return actionName(action);
		},
		displayValue: () => (action.enabled ? "" : t("off")),
		status: () => (actionWarning(action) ? "warning" : null),
		items: [
			{
				type: "group",
				items: [
					{ name: t("actionEnabled"), desc: t("actionEnabledDesc"), control: { type: "toggle", key: actionKey(action.id, "enabled") } },
					{ name: t("actionName"), desc: t("actionNameDesc"), control: { type: "text", key: actionKey(action.id, "name"), placeholder: t("untitledAction") } },
				],
			},
			inputsList(action, context),
			writesList(action, context),
		],
	};
}

function inputsList(action: DateAction, context: ActionsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("actionQuestions"),
		emptyState: t("noQuestionsYet"),
		items: action.inputs.map((input) => inputPage(action, input)),
		onReorder: (from, to) => context.change(() => moveEntry(action.inputs, from, to)),
		onDelete: (index) => context.change(() => action.inputs.splice(index, 1)),
		addItem: {
			name: t("addQuestion"),
			action: () => {
				const input = newInput(action.inputs);
				context.change(() => action.inputs.push(input));
				context.openPage(inputPageId(action, input));
			},
		},
	};
}

function inputPage(action: DateAction, input: ActionInput): IdentifiedPage {
	const key = (field: Parameters<typeof inputKey>[2]) => inputKey(action.id, input.id, field);
	const asksText = () => input.type !== "yesNo";
	return {
		type: "page",
		id: inputPageId(action, input),
		get name() {
			return inputName(input);
		},
		get desc() {
			return input.question;
		},
		displayValue: () => t(INPUT_TYPE_LABELS[input.type]),
		items: [
			{
				type: "group",
				items: [
					{ name: t("inputKey"), desc: t("inputKeyDesc"), control: { type: "text", key: key("key"), placeholder: input.id } },
					{ name: t("inputQuestion"), desc: t("inputQuestionDesc"), control: { type: "text", key: key("question"), placeholder: inputName(input) } },
					{ name: t("inputFieldType"), desc: t("inputFieldTypeDesc"), control: { type: "dropdown", key: key("type"), options: translatedLabels(INPUT_TYPE_LABELS) } },
					{ name: t("inputOptional"), desc: t("inputOptionalDesc"), control: { type: "toggle", key: key("optional") } },
					{
						name: t("inputDefaultText"),
						get desc() {
							return asksText() ? t("inputDefaultTextDesc") : t("inputDefaultYesNoDesc");
						},
						control: { type: "text", key: key("defaultText") },
					},
				],
			},
		],
	};
}

function writesList(action: DateAction, context: ActionsPageContext): SettingDefinitionList {
	return {
		type: "list",
		heading: t("actionWrites"),
		emptyState: t("noWritesYet"),
		items: action.writes.map((write) => writePage(action, write)),
		onReorder: (from, to) => context.change(() => moveEntry(action.writes, from, to)),
		onDelete: (index) => context.change(() => action.writes.splice(index, 1)),
		addItem: {
			name: t("addWrite"),
			action: () => {
				const write = newWrite(action.writes, action.inputs);
				context.change(() => action.writes.push(write));
				context.openPage(writePageId(action, write));
			},
		},
	};
}

export function writeName(write: ActionWrite): string {
	if (write.target === "body") return t("writeTargetBody");
	return write.property.trim() === "" ? t("untitledProperty") : write.property.trim();
}

export function answerOptions(action: DateAction, write: ActionWrite): Record<string, string> {
	const options: Record<string, string> = {};
	if (!action.inputs.some((input) => input.id === write.input && asksForNotes(input))) options[write.input] = t("chooseAQuestion");
	for (const input of action.inputs.filter(asksForNotes)) options[input.id] = inputName(input);
	return options;
}

export function conditionOptions(action: DateAction, write: ActionWrite): Record<string, string> {
	const options: Record<string, string> = { [ALWAYS]: t("conditionAlways") };
	if (write.condition !== ALWAYS && inputOf(action, write.condition)?.type !== "yesNo") options[write.condition] = t("missingQuestion");
	for (const input of action.inputs.filter((candidate) => candidate.type === "yesNo")) options[input.id] = t("conditionYes", { question: inputName(input) });
	return options;
}

function writePage(action: DateAction, write: ActionWrite): IdentifiedPage {
	const key = (field: Parameters<typeof writeKey>[2]) => writeKey(action.id, write.id, field);
	const isProperty = () => write.target === "property";
	const items: SettingDefinitionItem[] = [
		{ name: t("writeTarget"), desc: t("writeTargetDesc"), control: { type: "dropdown", key: key("target"), options: translatedLabels(TARGET_LABELS) } },
		{ name: t("writeProperty"), desc: t("writePropertyDesc"), visible: isProperty, control: { type: "text", key: key("property"), placeholder: "dates" } },
		{
			name: t("writeInput"),
			desc: t("writeInputDesc"),
			control: {
				type: "dropdown",
				key: key("input"),
				get options() {
					return answerOptions(action, write);
				},
			},
		},
		{ name: t("writeValue"), desc: t("writeValueDesc"), control: { type: "dropdown", key: key("value"), options: translatedLabels(VALUE_LABELS) } },
		{ name: t("valueFormat"), desc: t("valueFormatDesc"), control: { type: "dropdown", key: key("format"), options: translatedLabels(FORMAT_LABELS) } },
		{ name: t("propertyMode"), desc: t("propertyModeDesc"), visible: isProperty, control: { type: "dropdown", key: key("mode"), options: translatedLabels(MODE_LABELS) } },
		{
			name: t("writeCondition"),
			desc: t("writeConditionDesc"),
			control: {
				type: "dropdown",
				key: key("condition"),
				get options() {
					return conditionOptions(action, write);
				},
			},
		},
	];
	const group: SettingDefinitionGroup = { type: "group", items: items as SettingDefinitionGroup["items"] };
	return {
		type: "page",
		id: writePageId(action, write),
		get name() {
			return writeName(write);
		},
		get desc() {
			return writeWarning(action, write) ?? writeSummary(action, write);
		},
		status: () => (writeWarning(action, write) ? "warning" : null),
		items: [group],
	};
}

export function writeSummary(action: DateAction, write: ActionWrite): string {
	const input = inputOf(action, write.input);
	return t("writeSummary", { value: t(VALUE_LABELS[write.value]), question: input ? inputName(input) : t("missingQuestion") });
}
