import type { Moment } from "moment";
import type { SettingDefinitionGroup, SettingDefinitionItem, SettingDefinitionList, SettingGroupItem } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import type { Period } from "../dateNotes/periods.ts";
import { DEFAULT_ALIAS_FORMAT, DEFAULT_LINK_TEMPLATE, LINK_STYLE_FIELDS, addTarget, canRemoveTarget, removeTarget, targetsToAdd } from "../insertion/linkStyle.ts";
import type { AliasShape, LinkSeparator, LinkStyle, LinkStyleField } from "../insertion/linkStyle.ts";
import type { LinkPath } from "../insertion/linkPath.ts";
import { formatError, linkStyleKey, linkTemplateError } from "./controlKeys.ts";
import { PERIOD_LABELS } from "./dateNotesPage.ts";
import { addTodaySample, todayIn } from "./todaySample.ts";
import type { SampleHost } from "./todaySample.ts";

const LINK_PATH_LABELS: Record<LinkPath, TranslationKey> = {
	shortestWhenSafe: "linkPathShortestWhenSafe",
	name: "linkPathName",
	fullPath: "linkPathFullPath",
};

const SEPARATOR_LABELS: Record<LinkSeparator, TranslationKey> = {
	commaSpace: "separatorCommaSpace",
	space: "separatorSpace",
	bulletLines: "separatorBulletLines",
	lines: "separatorLines",
};

const ALIAS_SHAPE_LABELS: Record<AliasShape, TranslationKey> = {
	typed: "aliasTyped",
	format: "aliasFormat",
};

export interface TargetChoice {
	period: Period;
	name: string;
}

export interface LinkStyleHost extends SampleHost {
	isEnabledInDateNotes: (period: Period) => boolean;
	chooseTarget: (anchor: HTMLElement, choices: TargetChoice[], pick: (period: Period) => void) => void;
	notify: (message: string) => void;
}

export interface LinkStyleSection {
	keyPrefix: string;
	style: () => LinkStyle;
	host: LinkStyleHost;
	fields?: readonly LinkStyleField[];
}

export function aliasFormatSample(typed: string, today: Moment): string {
	return formatError(typed) ?? todayIn(typed.trim(), today);
}

export function targetNames(targets: readonly Period[]): string {
	return targets.map((period) => t(PERIOD_LABELS[period])).join(", ");
}

export function linkStyleItems(section: LinkStyleSection): SettingDefinitionItem[] {
	const shown = LINK_STYLE_FIELDS.filter((field) => (section.fields ?? LINK_STYLE_FIELDS).includes(field));
	const shownOf = (fields: Partial<Record<LinkStyleField, SettingGroupItem>>): SettingGroupItem[] =>
		shown.flatMap((field) => {
			const item = fields[field];
			return item ? [item] : [];
		});
	const groups: SettingDefinitionGroup[] = [
		{ type: "group", heading: t("linksSection"), items: shownOf(linkFields(section)) },
		{ type: "group", heading: t("linkTextSection"), items: shownOf(linkTextFields(section)) },
	];
	return [...(shown.includes("targets") ? [targetsList(section)] : []), ...groups.filter((group) => (group.items ?? []).length > 0)];
}

function targetsList({ keyPrefix, style, host }: LinkStyleSection): SettingDefinitionList {
	const targets = style().targets;
	const remaining = targetsToAdd(targets);
	const write = (next: Period[]) => host.write(linkStyleKey(keyPrefix, "targets"), next);
	return {
		type: "list",
		heading: t("targets"),
		items: targets.map((period) => ({
			name: t(PERIOD_LABELS[period]),
			desc: host.isEnabledInDateNotes(period) ? undefined : t("targetOffInDateNotes"),
		})),
		onDelete: (position: number) => {
			if (!canRemoveTarget(targets)) host.notify(t("keepOneTarget"));
			else write(removeTarget(targets, targets[position]));
		},
		addItem: {
			name: t("addTarget"),
			action: (anchor: HTMLElement) => {
				if (remaining.length === 0) host.notify(t("everyTargetListed"));
				else host.chooseTarget(anchor, remaining.map((period) => ({ period, name: t(PERIOD_LABELS[period]) })), (period) => write(addTarget(targets, period)));
			},
		},
	};
}

function linkFields({ keyPrefix }: LinkStyleSection): Partial<Record<LinkStyleField, SettingGroupItem>> {
	return {
		template: {
			name: t("linkTemplate"),
			desc: t("linkTemplateDesc"),
			control: { type: "text", key: linkStyleKey(keyPrefix, "template"), placeholder: DEFAULT_LINK_TEMPLATE, validate: linkTemplateError },
		},
		linkPath: {
			name: t("linkPath"),
			desc: t("linkPathDesc"),
			control: { type: "dropdown", key: linkStyleKey(keyPrefix, "linkPath"), options: translatedLabels(LINK_PATH_LABELS) },
		},
		separator: {
			name: t("insertionSeparator"),
			desc: t("insertionSeparatorDesc"),
			control: { type: "dropdown", key: linkStyleKey(keyPrefix, "separator"), options: translatedLabels(SEPARATOR_LABELS) },
		},
	};
}

function linkTextFields({ keyPrefix, style, host }: LinkStyleSection): Partial<Record<LinkStyleField, SettingGroupItem>> {
	return {
		aliasShape: {
			name: t("aliasShape"),
			desc: t("aliasShapeDesc"),
			control: { type: "dropdown", key: linkStyleKey(keyPrefix, "aliasShape"), options: translatedLabels(ALIAS_SHAPE_LABELS) },
		},
		aliasFormat: {
			name: t("aliasFormatSetting"),
			desc: t("aliasFormatSettingDesc"),
			visible: () => style().aliasShape === "format",
			render: (setting) => {
				const sample = addTodaySample(setting, aliasFormatSample(style().aliasFormat, host.today()));
				setting.addText((text) =>
					text
						.setPlaceholder(DEFAULT_ALIAS_FORMAT)
						.setValue(style().aliasFormat)
						.onChange((typed) => {
							sample.show(aliasFormatSample(typed, host.today()));
							host.write(linkStyleKey(keyPrefix, "aliasFormat"), typed);
						}),
				);
				return sample.remove;
			},
		},
	};
}
