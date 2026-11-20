import { AbstractInputSuggest, DropdownComponent, TextComponent, getAllTags, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { propertyType, valueShape } from "../filters/conditions.ts";
import type { PropertyType, ValueShape } from "../filters/conditions.ts";
import { FILE_FIELDS, ruleValueType } from "../filters/filters.ts";
import type { FileField, FilterGroup, FilterNode, FilterRule, PropertyRule } from "../filters/filters.ts";
import type { PropertySuggestion } from "../filters/obsidianVault.ts";
import {
	RULE_FIELDS,
	addCondition,
	addGroup,
	canAddGroup,
	changeRuleField,
	dateModeOptions,
	directionOptions,
	fileFieldLabel,
	filterModeOptions,
	fitRuleToProperty,
	fixedDateError,
	inapplicableRule,
	operatorOptions,
	readConditionField,
	removeNode,
	typeLabel,
	writeConditionField,
	writeMode,
	writeProperty,
} from "./filterForm.ts";
import type { ConditionField, RuleField } from "./filterForm.ts";
import { Combobox } from "./combobox.ts";
import type { ComboboxItem } from "./combobox.ts";

interface TextSuggestion {
	value: string;
	label?: string;
	detail?: string;
}

class TextSuggest extends AbstractInputSuggest<TextSuggestion> {
	private readonly candidates: () => TextSuggestion[];

	constructor(app: App, inputEl: HTMLInputElement, suggestions: () => TextSuggestion[]) {
		super(app, inputEl);
		this.candidates = suggestions;
	}

	protected getSuggestions(query: string): TextSuggestion[] {
		const typed = query.trim().toLowerCase();
		return this.candidates().filter((suggestion) => (suggestion.label ?? suggestion.value).toLowerCase().includes(typed) || suggestion.value.toLowerCase().includes(typed));
	}

	renderSuggestion(suggestion: TextSuggestion, el: HTMLElement): void {
		el.createDiv({ text: suggestion.label ?? suggestion.value });
		if (suggestion.detail) el.createDiv({ text: suggestion.detail, cls: "setting-item-description" });
	}
}

export interface FieldChoice {
	value: RuleField;
	name: string;
}

export interface FilterEditing {
	app: App;
	propertyTypes: Record<string, string>;
	propertySuggestions: () => PropertySuggestion[];
	chooseField: (anchor: HTMLElement, choices: FieldChoice[], pick: (field: RuleField) => void) => void;
	change: (change: () => unknown) => void;
}

type Suggestions = (editing: FilterEditing) => TextSuggestion[];

const folderSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getAllFolders()
		.map((folder) => ({ value: folder.path }))
		.sort((a, b) => a.value.localeCompare(b.value));

const tagSuggestions: Suggestions = ({ app }) => {
	const tags = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		for (const tag of cache ? getAllTags(cache) ?? [] : []) tags.add(tag.replace(/^#/, ""));
	}
	return [...tags].sort((a, b) => a.localeCompare(b)).map((value) => ({ value }));
};

const noteSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getMarkdownFiles()
		.map((file) => ({ value: file.path, label: file.basename, detail: file.path }))
		.sort((a, b) => a.label.localeCompare(b.label));

const pathSuggestions: Suggestions = ({ app }) =>
	app.vault
		.getAllFolders()
		.map((folder) => ({ value: `${folder.path}/` }))
		.sort((a, b) => a.value.localeCompare(b.value));

const propertyNameSuggestions: Suggestions = (editing) =>
	editing.propertySuggestions().map((suggestion) => ({ value: suggestion.name, detail: typeLabel(suggestion.type) }));

const SHAPE_SUGGESTIONS: Partial<Record<ValueShape, Suggestions>> = {
	note: noteSuggestions,
	folder: folderSuggestions,
	tag: tagSuggestions,
	property: propertyNameSuggestions,
};

const FIELD_SUGGESTIONS: Partial<Record<FileField, Suggestions>> = {
	folder: folderSuggestions,
	path: pathSuggestions,
	links: noteSuggestions,
	backlinks: noteSuggestions,
	embeds: noteSuggestions,
	tags: tagSuggestions,
};

const SHAPE_PLACEHOLDERS: Partial<Record<ValueShape, TranslationKey>> = {
	note: "filterNote",
	folder: "filterFolder",
	tag: "filterTag",
	property: "filterProperty",
	texts: "filterValues",
};

const EDITOR_CLASS = "date-compass-filter";

const PROPERTY_ICONS: Record<PropertyType, string> = {
	text: "lucide-text",
	multitext: "lucide-list",
	tags: "lucide-tags",
	aliases: "lucide-forward",
	number: "lucide-binary",
	checkbox: "lucide-check-square",
	date: "lucide-calendar",
	datetime: "lucide-clock",
};

const FILE_FIELD_ICONS: Record<FileField, string> = {
	file: "lucide-file",
	name: "lucide-text",
	basename: "lucide-text",
	fullname: "lucide-text",
	path: "lucide-text",
	folder: "lucide-folder",
	ext: "lucide-text",
	ctime: "lucide-clock",
	mtime: "lucide-clock",
	size: "lucide-binary",
	links: "lucide-link",
	backlinks: "lucide-link",
	embeds: "lucide-link",
	tags: "lucide-tags",
};

const FILE_FIELD_PREFIX = "file:";

const PROPERTY_PREFIX = "property:";

export function renderFilter(settingEl: HTMLElement, filter: FilterGroup, editing: FilterEditing): () => void {
	settingEl.addClass("date-compass-filter-setting");
	settingEl.querySelectorAll(`:scope > .${EDITOR_CLASS}`).forEach((el) => el.remove());
	const editorEl = settingEl.createDiv({ cls: ["bases-query-container", EDITOR_CLASS] });
	const redraw = () => {
		editorEl.empty();
		renderGroup(editorEl, filter, { depth: 1, editing: { ...editing, change } });
	};
	const change = (mutate: () => unknown) => {
		editing.change(mutate);
		if (editorEl.isConnected) redraw();
	};
	redraw();
	return () => editorEl.remove();
}

interface GroupPlace {
	depth: number;
	parent?: GroupPlace & { group: FilterGroup };
	editing: FilterEditing;
}

function renderGroup(parentEl: HTMLElement, group: FilterGroup, place: GroupPlace): void {
	const { editing } = place;
	const groupEl = parentEl.createDiv({ cls: "filter-group" });
	const { parent } = place;
	const hasItems = group.items.length > 0;
	if (hasItems || parent) {
		const headerEl = groupEl.createDiv({ cls: "filter-group-header" });
		if (hasItems) {
			const modeEl = headerEl.createEl("select", { cls: ["conjunction", "dropdown"] });
			for (const [mode, label] of Object.entries(filterModeOptions())) {
				modeEl.createEl("option", { text: label, attr: { value: mode } }).selected = mode === group.mode;
			}
			modeEl.addEventListener("change", () => editing.change(() => writeMode(group, modeEl.value)));
		}
		const headerActionsEl = headerEl.createDiv({ cls: "filter-group-header-actions" });
		if (parent) iconButton(headerActionsEl, "x", t("filterRemoveGroup"), () => editing.change(() => removeFrom(parent, group)));
	}
	const statementsEl = groupEl.createDiv({ cls: "filter-group-statements" });
	const here = { ...place, group };
	group.items.forEach((item, index) => {
		const rowEl = statementsEl.createDiv({ cls: "filter-row" });
		rowEl.createSpan({ cls: "conjunction", text: t(index === 0 ? "filterWhere" : group.mode === "all" ? "filterAnd" : "filterOr") });
		if (item.kind === "group") {
			rowEl.addClass("mod-group");
			renderGroup(rowEl, item, { depth: place.depth + 1, parent: here, editing });
		} else {
			renderRule(rowEl, item, here);
		}
	});
	const actionsEl = groupEl.createDiv({ cls: "filter-group-actions" });
	textIconButton(actionsEl, "plus", t("filterAdd"), (anchor) => editing.chooseField(anchor, fieldChoices(), (field) => editing.change(() => addCondition(group, field))));
	if (canAddGroup(place.depth)) {
		textIconButton(actionsEl, "plus", t("filterAddGroup"), (anchor) => editing.chooseField(anchor, fieldChoices(), (field) => editing.change(() => addGroup(group, field))));
	}
}

function fieldChoices(): FieldChoice[] {
	return RULE_FIELDS.map((field) => ({ value: field, name: field === "property" ? t("filterProperty") : fileFieldLabel(field) }));
}

function removeFrom(place: GroupPlace & { group: FilterGroup }, node: FilterNode): void {
	removeNode(place.group, node);
	if (place.group.items.length === 0 && place.parent) removeFrom(place.parent, place.group);
}

function renderRule(parentEl: HTMLElement, rule: FilterRule, place: GroupPlace & { group: FilterGroup }): void {
	const { editing, group } = place;
	const statementEl = parentEl.createDiv({ cls: "filter-statement" });
	const expressionEl = statementEl.createDiv({ cls: ["filter-expression", "metadata-property"] });
	renderLeftSide(expressionEl, rule, group, editing);
	const rightEl = createRightSide(expressionEl, statementEl, rule, editing);
	const actionsEl = expressionEl.createDiv({ cls: "filter-row-actions" });
	iconButton(actionsEl, "x", t("filterRemove"), () => editing.change(() => removeFrom(place, rule)));
	const inapplicable = inapplicableRule(rule, editing.propertyTypes);
	if (inapplicable) statementEl.createDiv({ cls: "filter-row-error", text: inapplicable });
	if (rightEl.childElementCount === 0) rightEl.addClass("is-empty");
}

function renderLeftSide(expressionEl: HTMLElement, rule: FilterRule, group: FilterGroup, editing: FilterEditing): void {
	const combobox = new Combobox(expressionEl, {
		app: editing.app,
		items: () => fieldItems(editing),
		placeholder: t("filterProperty"),
		searchPlaceholder: t("filterSearch"),
		extraItem: (query, items) => (query === "" || items.some((item) => item.label === query) ? undefined : { value: PROPERTY_PREFIX + query, label: query, icon: PROPERTY_ICONS.text }),
		onSelect: (item) =>
			editing.change(() => {
				if (item.value.startsWith(FILE_FIELD_PREFIX)) {
					changeRuleField(group, rule, item.value.slice(FILE_FIELD_PREFIX.length));
					return;
				}
				const target: PropertyRule | undefined = rule.kind === "property" ? rule : replaceWithProperty(group, rule);
				if (!target) return;
				writeProperty(target, item.value.slice(PROPERTY_PREFIX.length));
				fitRuleToProperty(target, editing.propertyTypes);
			}),
	});
	combobox.buttonEl.addClass("filter-property-select");
	combobox.setValue(rule.kind === "property" && rule.property === "" ? undefined : selectedField(rule, editing));
}

function selectedField(rule: FilterRule, editing: FilterEditing): ComboboxItem {
	if (rule.kind === "file") return fileFieldItem(rule.field);
	return { value: PROPERTY_PREFIX + rule.property, label: rule.property, icon: PROPERTY_ICONS[propertyType(editing.propertyTypes, rule.property)] };
}

function replaceWithProperty(group: FilterGroup, rule: FilterRule): PropertyRule | undefined {
	const index = group.items.indexOf(rule);
	changeRuleField(group, rule, "property");
	const replacement = group.items[index];
	return replacement?.kind === "property" ? replacement : undefined;
}

function fileFieldItem(field: FileField): ComboboxItem {
	return { value: FILE_FIELD_PREFIX + field, label: fileFieldLabel(field), icon: FILE_FIELD_ICONS[field], detail: `file.${field}` };
}

function fieldItems(editing: FilterEditing): ComboboxItem[] {
	const properties = editing.propertySuggestions().map((suggestion) => ({
		value: PROPERTY_PREFIX + suggestion.name,
		label: suggestion.name,
		icon: PROPERTY_ICONS[suggestion.type],
	}));
	return [...FILE_FIELDS.map(fileFieldItem), ...properties];
}

function createRightSide(expressionEl: HTMLElement, statementEl: HTMLElement, rule: FilterRule, editing: FilterEditing): HTMLElement {
	const unchosen = rule.kind === "property" && rule.property === "";
	const type = ruleValueType(rule, editing.propertyTypes);
	const { operator } = rule.condition;
	const operators = Object.entries(operatorOptions(type, operator)).map(([value, label]) => ({ value, label }));
	const combobox = new Combobox(expressionEl, {
		app: editing.app,
		items: () => operators,
		placeholder: "",
		searchPlaceholder: t("filterSearch"),
		onSelect: (item) => editing.change(() => writeConditionField(rule, "operator", item.value, editing.propertyTypes)),
	});
	combobox.buttonEl.addClass("filter-operator");
	combobox.setValue(operators.find((item) => item.value === operator)).setDisabled(unchosen);
	const rightEl = expressionEl.createDiv({ cls: ["filter-rhs-container", "metadata-property-value"] });
	const shape = valueShape(type, operator);
	if (!unchosen && shape !== undefined) renderConditionValue(rightEl, statementEl, rule, shape, editing);
	return rightEl;
}

function valueSuggestions(rule: FilterRule, shape: ValueShape): Suggestions | undefined {
	if (shape !== "text") return SHAPE_SUGGESTIONS[shape];
	return rule.kind === "file" ? FIELD_SUGGESTIONS[rule.field] : undefined;
}

function renderConditionValue(rowEl: HTMLElement, statementEl: HTMLElement, rule: FilterRule, shape: ValueShape, editing: FilterEditing): void {
	const draft = (field: ConditionField, value: unknown) => writeConditionField(rule, field, value, editing.propertyTypes);
	const write = (field: ConditionField, value: unknown) => editing.change(() => writeConditionField(rule, field, value, editing.propertyTypes));
	const edit = (field: ConditionField): TextEdit => ({ typing: (value) => draft(field, value), commit: (value) => write(field, value) });
	const numberEdit = (field: ConditionField): TextEdit => ({
		typing: (value) => {
			if (isNumber(value)) draft(field, Number(value));
		},
		commit: (value) => {
			if (isNumber(value)) write(field, Number(value));
		},
	});
	const read = (field: ConditionField) => readConditionField(rule, field);
	const readText = (field: ConditionField) => {
		const value = read(field);
		return typeof value === "string" ? value : "";
	};
	const readNumber = (field: ConditionField) => {
		const value = read(field);
		return typeof value === "number" ? value : 0;
	};
	if (shape === "none") return;
	if (shape === "number") {
		numberInput(rowEl, readNumber("number"), numberEdit("number"));
		return;
	}
	if (shape === "boolean") {
		const checkboxEl = rowEl.createEl("input", { type: "checkbox", cls: "metadata-input-checkbox" });
		checkboxEl.checked = read("boolean") === true;
		checkboxEl.addEventListener("change", () => write("boolean", checkboxEl.checked));
		return;
	}
	if (shape === "texts") {
		textInput(rowEl, readText("texts"), t("filterValues"), edit("texts"));
		return;
	}
	if (shape !== "date") {
		const placeholder = SHAPE_PLACEHOLDERS[shape];
		const text = textInput(rowEl, readText("text"), t(placeholder ?? "filterValue"), edit("text"));
		const suggestions = valueSuggestions(rule, shape);
		if (!suggestions) return;
		let cached: TextSuggestion[] | undefined;
		const suggest = new TextSuggest(editing.app, text.inputEl, () => (cached = cached ?? suggestions(editing)));
		suggest.onSelect((suggestion) => {
			suggest.setValue(suggestion.value);
			suggest.close();
			write("text", suggestion.value);
		});
		return;
	}
	new DropdownComponent(rowEl)
		.addOptions(dateModeOptions())
		.setValue(readText("dateMode"))
		.onChange((mode) => write("dateMode", mode));
	if (readText("dateMode") === "fixed") {
		const errorEl = statementEl.createDiv({ cls: "filter-row-error" });
		const valid = (value: string) => {
			const error = value.trim() === "" ? undefined : fixedDateError(value.trim());
			errorEl.toggle(error !== undefined);
			errorEl.setText(error ?? "");
			return value.trim() !== "" && error === undefined;
		};
		const date = readText("date");
		valid(date);
		textInput(rowEl, date, "YYYY-MM-DD", {
			typing: (value) => {
				if (valid(value)) draft("date", value);
			},
			commit: (value) => {
				if (valid(value)) write("date", value);
			},
		});
		return;
	}
	new DropdownComponent(rowEl)
		.addOptions(directionOptions())
		.setValue(readText("direction"))
		.onChange((direction) => write("direction", direction));
	if (readText("direction") !== "today") numberInput(rowEl, readNumber("days"), numberEdit("days"), 1);
}

interface TextEdit {
	typing: (value: string) => void;
	commit: (value: string) => void;
}

function isNumber(value: string): boolean {
	return value.trim() !== "" && Number.isFinite(Number(value));
}

function textInput(parentEl: HTMLElement, value: string, placeholder: string, edit: TextEdit): TextComponent {
	const text = new TextComponent(parentEl).setPlaceholder(placeholder).setValue(value);
	text.inputEl.addEventListener("input", () => edit.typing(text.getValue()));
	text.inputEl.addEventListener("change", () => edit.commit(text.getValue()));
	return text;
}

function numberInput(parentEl: HTMLElement, value: number, edit: TextEdit, min?: number): void {
	const text = textInput(parentEl, String(value), "", edit);
	text.inputEl.type = "number";
		if (min === undefined) return;
	text.inputEl.min = String(min);
	text.inputEl.step = "1";
}

function textIconButton(parentEl: HTMLElement, icon: string, label: string, onClick: (anchor: HTMLElement) => void): void {
	const buttonEl = parentEl.createDiv({ cls: ["text-icon-button", "tappable"], attr: { tabindex: "0", role: "button" } });
	setIcon(buttonEl.createSpan({ cls: "text-button-icon" }), icon);
	buttonEl.createSpan({ cls: "text-button-label", text: label });
	pressable(buttonEl, onClick);
}

function iconButton(parentEl: HTMLElement, icon: string, label: string, onClick: () => void): void {
	const buttonEl = parentEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
	setIcon(buttonEl, icon);
	pressable(buttonEl, onClick);
}

function pressable(el: HTMLElement, onClick: (anchor: HTMLElement) => void): void {
	el.addEventListener("mousedown", (event) => event.preventDefault());
	el.addEventListener("click", (event) => {
		event.preventDefault();
		onClick(el);
	});
	el.addEventListener("keydown", (event) => {
		if (el.tagName === "BUTTON" || (event.key !== "Enter" && event.key !== " ")) return;
		event.preventDefault();
		onClick(el);
	});
}
