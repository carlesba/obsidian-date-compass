import type { Moment } from "moment";
import type { SettingDefinitionGroup } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { DEFAULT_ALIAS_FORMAT, DEFAULT_LINK_TEMPLATE } from "../insertion/settings.ts";
import type { AliasShape, InsertionSettings, LinkSeparator } from "../insertion/settings.ts";
import {
	INSERTION_ALIAS_BY_DEFAULT_KEY,
	INSERTION_ALIAS_FORMAT_KEY,
	INSERTION_ALIAS_SHAPE_KEY,
	INSERTION_LINK_TEMPLATE_KEY,
	INSERTION_SEPARATOR_KEY,
	formatError,
	linkTemplateError,
} from "./controlKeys.ts";
import { addTodaySample, todayIn } from "./todaySample.ts";
import type { SampleHost } from "./todaySample.ts";

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

export function aliasFormatSample(typed: string, today: Moment): string {
	return formatError(typed) ?? todayIn(typed.trim(), today);
}

export function insertionGroups(insertion: () => InsertionSettings, host: SampleHost): SettingDefinitionGroup[] {
	return [
		{
			type: "group",
			items: [
				{
					name: t("linkTemplate"),
					desc: t("linkTemplateDesc"),
					control: { type: "text", key: INSERTION_LINK_TEMPLATE_KEY, placeholder: DEFAULT_LINK_TEMPLATE, validate: linkTemplateError },
				},
				{
					name: t("insertionSeparator"),
					desc: t("insertionSeparatorDesc"),
					control: { type: "dropdown", key: INSERTION_SEPARATOR_KEY, options: translatedLabels(SEPARATOR_LABELS) },
				},
			],
		},
		{
			type: "group",
			heading: t("linkTextSection"),
			items: [
				{
					name: t("aliasByDefault"),
					desc: t("aliasByDefaultDesc"),
					control: { type: "toggle", key: INSERTION_ALIAS_BY_DEFAULT_KEY },
				},
				{
					name: t("aliasShape"),
					desc: t("aliasShapeDesc"),
					control: { type: "dropdown", key: INSERTION_ALIAS_SHAPE_KEY, options: translatedLabels(ALIAS_SHAPE_LABELS) },
				},
				{
					name: t("aliasFormatSetting"),
					desc: t("aliasFormatSettingDesc"),
					visible: () => insertion().aliasShape === "format",
					render: (setting) => {
						const showSample = addTodaySample(setting, aliasFormatSample(insertion().aliasFormat, host.today()));
						setting.addText((text) =>
							text
								.setPlaceholder(DEFAULT_ALIAS_FORMAT)
								.setValue(insertion().aliasFormat)
								.onChange((typed) => {
									showSample(aliasFormatSample(typed, host.today()));
									host.write(INSERTION_ALIAS_FORMAT_KEY, typed);
								}),
						);
					},
				},
			],
		},
	];
}
