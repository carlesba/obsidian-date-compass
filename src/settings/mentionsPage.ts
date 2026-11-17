import type { SettingDefinitionGroup } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import { PERIODS } from "../dateNotes/periods.ts";
import type { AliasMode, LinkSeparator, MentionSettings } from "../mentions/settings.ts";
import {
	MENTIONS_ALIAS_FORMAT_KEY,
	MENTIONS_ALIAS_MODE_KEY,
	MENTIONS_ENABLED_KEY,
	MENTIONS_SEPARATOR_KEY,
	MENTIONS_TRIGGER_KEY,
	formatError,
	mentionPeriodKey,
	triggerError,
} from "./controlKeys.ts";
import { PERIOD_LABELS } from "./dateNotesPage.ts";

const ALIAS_MODE_LABELS: Record<AliasMode, TranslationKey> = {
	none: "aliasNone",
	typed: "aliasTyped",
	format: "aliasFormat",
};

const SEPARATOR_LABELS: Record<LinkSeparator, TranslationKey> = {
	commaSpace: "separatorCommaSpace",
	space: "separatorSpace",
	bulletLines: "separatorBulletLines",
};

export function sameTriggerWarning(names: readonly string[]): string | undefined {
	return names.length === 0 ? undefined : t("sameTriggerWarning", { plugins: names.join(", ") });
}

export function mentionGroups(mentions: () => MentionSettings, sameTriggerNames: readonly string[]): SettingDefinitionGroup[] {
	const isOn = () => mentions().enabled;
	const warning = sameTriggerWarning(sameTriggerNames);
	return [
		{
			type: "group",
			items: [
				{ name: t("mentionsEnabled"), desc: t("mentionsEnabledDesc"), control: { type: "toggle", key: MENTIONS_ENABLED_KEY } },
				{
					name: t("mentionTrigger"),
					desc: t("mentionTriggerDesc"),
					visible: isOn,
					control: { type: "text", key: MENTIONS_TRIGGER_KEY, placeholder: "@", validate: triggerError },
				},
				...(warning ? [{ name: t("sameTriggerTitle"), desc: warning, visible: isOn }] : []),
			],
		},
		{
			type: "group",
			heading: t("mentionPeriods"),
			visible: isOn,
			items: PERIODS.map((period) => ({
				name: t(PERIOD_LABELS[period]),
				desc: t("mentionPeriodDesc"),
				control: { type: "toggle" as const, key: mentionPeriodKey(period) },
			})),
		},
		{
			type: "group",
			visible: isOn,
			items: [
				{
					name: t("mentionAlias"),
					desc: t("mentionAliasDesc"),
					control: { type: "dropdown", key: MENTIONS_ALIAS_MODE_KEY, options: translatedLabels(ALIAS_MODE_LABELS) },
				},
				{
					name: t("mentionAliasFormat"),
					desc: t("mentionAliasFormatDesc"),
					visible: () => mentions().aliasMode === "format",
					control: { type: "text", key: MENTIONS_ALIAS_FORMAT_KEY, placeholder: "ddd D MMM", validate: formatError },
				},
				{
					name: t("mentionSeparator"),
					desc: t("mentionSeparatorDesc"),
					control: { type: "dropdown", key: MENTIONS_SEPARATOR_KEY, options: translatedLabels(SEPARATOR_LABELS) },
				},
			],
		},
	];
}
