import type { SettingDefinitionGroup } from "obsidian";
import { t } from "../i18n/index.ts";
import { PERIODS } from "../dateNotes/periods.ts";
import type { MentionSettings } from "../mentions/settings.ts";
import {
	MENTIONS_ENABLED_KEY,
	MENTIONS_TRIGGER_KEY,
	mentionPeriodKey,
	triggerError,
} from "./controlKeys.ts";
import { PERIOD_LABELS } from "./dateNotesPage.ts";

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
	];
}
