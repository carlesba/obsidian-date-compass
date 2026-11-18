import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { OPERATORS_BY_TYPE, conditionFits, conditionFor, fitCondition, isDateValue, propertyType, valueShape } from "../filters/conditions.ts";
import type { DateValue, Operator, PropertyType, ValueType } from "../filters/conditions.ts";
import { FILE_FIELDS, FILE_FIELD_TYPES, FILTER_MODES, MAX_FILTER_DEPTH, fileRule, filterRules, ruleValueType } from "../filters/filters.ts";
import type { FileField, FilterGroup, FilterMode, FilterNode, FilterRule, PropertyRule } from "../filters/filters.ts";

export type RuleField = "property" | FileField;

export type ConditionField = "operator" | "text" | "texts" | "number" | "boolean" | "dateMode" | "date" | "days" | "direction";

const FILTER_MODE_KEYS: Record<FilterMode, TranslationKey> = { all: "filterModeAll", any: "filterModeAny", none: "filterModeNone" };

const OPERATOR_KEYS: Partial<Record<Operator, TranslationKey>> = {
	is: "filterOperatorIs",
	"is not": "filterOperatorIsNot",
	"is exactly": "filterOperatorIsExactly",
	"is not exactly": "filterOperatorIsNotExactly",
	on: "filterOperatorOn",
	"not on": "filterOperatorNotOn",
	before: "filterOperatorBefore",
	"on or before": "filterOperatorOnOrBefore",
	after: "filterOperatorAfter",
	"on or after": "filterOperatorOnOrAfter",
	"starts with": "filterOperatorStartsWith",
	"does not start with": "filterOperatorDoesNotStartWith",
	"ends with": "filterOperatorEndsWith",
	"does not end with": "filterOperatorDoesNotEndWith",
	"is empty": "filterOperatorIsEmpty",
	"is not empty": "filterOperatorIsNotEmpty",
	contains: "filterOperatorContains",
	"does not contain": "filterOperatorDoesNotContain",
	"contains any of": "filterOperatorContainsAnyOf",
	"does not contain any of": "filterOperatorDoesNotContainAnyOf",
	"contains all of": "filterOperatorContainsAllOf",
	"does not contain all of": "filterOperatorDoesNotContainAllOf",
	"links to": "filterOperatorLinksTo",
	"does not link to": "filterOperatorDoesNotLinkTo",
	"in folder": "filterOperatorInFolder",
	"is not in folder": "filterOperatorIsNotInFolder",
	"has tag": "filterOperatorHasTag",
	"does not have tag": "filterOperatorDoesNotHaveTag",
	"has property": "filterOperatorHasProperty",
	"does not have property": "filterOperatorDoesNotHaveProperty",
};

const TYPE_KEYS: Record<PropertyType, TranslationKey> = {
	text: "filterTypeText",
	multitext: "filterTypeMultitext",
	tags: "filterTypeTags",
	aliases: "filterTypeAliases",
	number: "filterTypeNumber",
	checkbox: "filterTypeCheckbox",
	date: "filterTypeDate",
	datetime: "filterTypeDatetime",
};

const FIXED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const FILE_FIELD_KEYS: Record<FileField, TranslationKey> = {
	file: "filterFieldFile",
	name: "filterFieldFileName",
	basename: "filterFieldFileBaseName",
	fullname: "filterFieldFileFullName",
	path: "filterFieldFilePath",
	folder: "filterFieldFolder",
	ext: "filterFieldFileExtension",
	ctime: "filterFieldCreatedTime",
	mtime: "filterFieldModifiedTime",
	size: "filterFieldFileSize",
	links: "filterFieldFileLinks",
	backlinks: "filterFieldFileBacklinks",
	embeds: "filterFieldFileEmbeds",
	tags: "filterFieldFileTags",
};

export function operatorLabel(operator: Operator): string {
	const key = OPERATOR_KEYS[operator];
	return key === undefined ? operator : t(key);
}

export function typeLabel(type: PropertyType): string {
	return t(TYPE_KEYS[type]);
}

export function dateModeOptions(): Record<"fixed" | "relative", string> {
	return { fixed: t("filterFixedDate"), relative: t("filterRelativeToToday") };
}

export function directionOptions(): Record<"ago" | "today" | "fromNow", string> {
	return { ago: t("filterDaysAgo"), today: t("filterToday"), fromNow: t("filterDaysFromNow") };
}

export function fixedDateError(value: string): string | undefined {
	if (FIXED_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) return undefined;
	return t("filterFixedDateFormat");
}

export function filterModeOptions(): Record<FilterMode, string> {
	return translatedLabels(FILTER_MODE_KEYS);
}

export function operatorOptions(type: ValueType, current?: Operator): Record<string, string> {
	const options: Record<string, string> = {};
	for (const operator of OPERATORS_BY_TYPE[type]) options[operator] = operatorLabel(operator);
	if (current !== undefined && !(current in options)) options[current] = t("filterOperatorDoesNotApply", { operator: operatorLabel(current) });
	return options;
}

export function ruleField(rule: FilterRule): RuleField {
	return rule.kind === "file" ? rule.field : "property";
}

export function fileFieldLabel(field: FileField): string {
	return t(FILE_FIELD_KEYS[field]);
}

export function newRule(field: RuleField): FilterRule {
	if (field === "property") return { kind: "property", property: "", condition: { operator: "contains", value: "" } };
	return fileRule(field);
}

export function canAddGroup(depth: number): boolean {
	return depth < MAX_FILTER_DEPTH;
}

export const RULE_FIELDS: readonly RuleField[] = [...FILE_FIELDS, "property"];

export function addCondition(group: FilterGroup, field: RuleField): void {
	group.items.push(newRule(field));
}

export function addGroup(group: FilterGroup, field: RuleField): void {
	group.items.push({ kind: "group", mode: "all", items: [newRule(field)] });
}

export function removeNode(group: FilterGroup, node: FilterNode): void {
	const index = group.items.indexOf(node);
	if (index !== -1) group.items.splice(index, 1);
}

export function changeRuleField(group: FilterGroup, rule: FilterRule, chosen: string): void {
	const field = chosen === "property" ? "property" : FILE_FIELDS.find((candidate) => candidate === chosen);
	const index = group.items.indexOf(rule);
	if (field === undefined || index === -1 || ruleField(rule) === field) return;
	const replacement = newRule(field);
	if (replacement.kind === "file" && conditionFits(rule.condition, FILE_FIELD_TYPES[replacement.field])) replacement.condition = rule.condition;
	group.items[index] = replacement;
}

export function writeMode(group: FilterGroup, mode: string): void {
	const chosen = FILTER_MODES.find((candidate) => candidate === mode);
	if (chosen) group.mode = chosen;
}

export function writeProperty(rule: PropertyRule, value: string): void {
	rule.property = value.trim();
}

export function fitRuleToProperty(rule: PropertyRule, types: Record<string, string>): void {
	if (rule.property === "") return;
	rule.condition = fitCondition(rule.condition, ruleValueType(rule, types));
}

export function inapplicableRule(rule: FilterRule, types: Record<string, string>): string | undefined {
	if (rule.kind !== "property") return undefined;
	if (conditionFits(rule.condition, ruleValueType(rule, types))) return undefined;
	return t("filterInapplicableRule", { operator: operatorLabel(rule.condition.operator), type: typeLabel(propertyType(types, rule.property)) });
}

export function inapplicableFilter(filter: FilterGroup, types: Record<string, string>): string | undefined {
	for (const rule of filterRules(filter)) {
		const warning = inapplicableRule(rule, types);
		if (warning) return warning;
	}
	return undefined;
}

export function readConditionField(rule: FilterRule, field: ConditionField): unknown {
	const { condition } = rule;
	if (field === "operator") return condition.operator;
	const { value } = condition;
	if (field === "text") return typeof value === "string" ? value : undefined;
	if (field === "texts") return Array.isArray(value) ? value.join(", ") : undefined;
	if (field === "number") return typeof value === "number" ? value : undefined;
	if (field === "boolean") return typeof value === "boolean" ? value : undefined;
	if (!isDateValue(value)) return undefined;
	if (field === "dateMode") return value.kind;
	if (field === "date") return value.kind === "fixed" ? value.date : "";
	const days = value.kind === "relative" ? value.days : 0;
	if (field === "days") return Math.abs(days);
	return days < 0 ? "ago" : days > 0 ? "fromNow" : "today";
}

export function writeConditionField(rule: FilterRule, field: ConditionField, value: unknown, types: Record<string, string>): void {
	const type = ruleValueType(rule, types);
	const { condition } = rule;
	if (field === "operator") {
		const operator = OPERATORS_BY_TYPE[type].find((candidate) => candidate === value);
		if (operator) rule.condition = conditionFor(type, operator, condition);
		return;
	}
	const shape = valueShape(type, condition.operator);
	if (field === "text" && typeof value === "string" && shape !== undefined && !["none", "texts", "number", "date", "boolean"].includes(shape)) {
		rule.condition = { operator: condition.operator, value };
	} else if (field === "texts" && typeof value === "string" && shape === "texts") {
		rule.condition = { operator: condition.operator, value: splitValues(value) };
	} else if (field === "number" && typeof value === "number" && Number.isFinite(value) && shape === "number") {
		rule.condition = { operator: condition.operator, value };
	} else if (field === "boolean" && typeof value === "boolean" && shape === "boolean") {
		rule.condition = { operator: condition.operator, value };
	} else if (shape === "date" && isDateValue(condition.value)) {
		rule.condition = { operator: condition.operator, value: dateFor(condition.value, field, value) };
	}
}

function splitValues(text: string): string[] {
	return text
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item !== "");
}

function dateFor(date: DateValue, field: ConditionField, value: unknown): DateValue {
	const days = date.kind === "relative" ? date.days : 0;
	if (field === "dateMode") {
		if (value === date.kind) return date;
		return value === "fixed" ? { kind: "fixed", date: "" } : { kind: "relative", days: 0 };
	}
	if (field === "date" && typeof value === "string" && date.kind === "fixed") return { kind: "fixed", date: value.trim() };
	if (field === "days" && typeof value === "number" && Number.isInteger(value) && value >= 1 && date.kind === "relative") {
		return { kind: "relative", days: days < 0 ? -value : value };
	}
	if (field === "direction" && date.kind === "relative") {
		const count = Math.max(1, Math.abs(days));
		return { kind: "relative", days: value === "ago" ? -count : value === "fromNow" ? count : 0 };
	}
	return date;
}

