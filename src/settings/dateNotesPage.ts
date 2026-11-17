import type { SettingDefinitionGroup, TFile } from "obsidian";
import { t, translatedLabels } from "../i18n/index.ts";
import type { TranslationKey } from "../i18n/index.ts";
import type { DateNoteSource, PeriodMismatch, SourceMismatch } from "../dateNotes/import.ts";
import { PERIODS } from "../dateNotes/periods.ts";
import type { Period, TemplateRunnerChoice } from "../dateNotes/periods.ts";
import { TEMPLATE_RUNNER_KEY, formatError, periodKey } from "./controlKeys.ts";

export const PERIOD_LABELS: Record<Period, TranslationKey> = {
	day: "periodDay",
	week: "periodWeek",
	month: "periodMonth",
	quarter: "periodQuarter",
	year: "periodYear",
};

const TEMPLATE_RUNNER_LABELS: Record<TemplateRunnerChoice, TranslationKey> = {
	automatic: "templateRunnerAutomatic",
	templater: "templateRunnerTemplater",
	coreTemplates: "templateRunnerCoreTemplates",
};

const MISMATCH_TITLES: Record<DateNoteSource, TranslationKey> = {
	periodicNotes: "mismatchPeriodicNotes",
	dailyNotes: "mismatchDailyNotes",
};

export function mismatchDescription(mismatch: SourceMismatch): string {
	return t("mismatchDesc", { differences: mismatch.differences.map(describeDifference).join(" ") });
}

function describeDifference({ period, field, theirs, ours }: PeriodMismatch): string {
	return t("mismatchDifference", {
		period: t(PERIOD_LABELS[period]),
		field: t(field === "folder" ? "folder" : "nameFormat"),
		theirs: shownValue(theirs),
		ours: shownValue(ours),
	});
}

function shownValue(value: string): string {
	return value === "" ? t("vaultRoot") : `"${value}"`;
}

export function mismatchGroups(mismatches: SourceMismatch[], copyIn: (source: DateNoteSource) => void): SettingDefinitionGroup[] {
	return mismatches.map((mismatch) => ({
		type: "group" as const,
		items: [
			{
				name: t(MISMATCH_TITLES[mismatch.source]),
				desc: mismatchDescription(mismatch),
				render: (setting) => {
					setting.addButton((button) =>
						button
							.setButtonText(t("copySettingsIn"))
							.setCta()
							.onClick(() => copyIn(mismatch.source)),
					);
				},
			},
		],
	}));
}

export function templateRunnerGroup(): SettingDefinitionGroup {
	return {
		type: "group",
		items: [
			{
				name: t("templateRunner"),
				desc: t("templateRunnerDesc"),
				control: { type: "dropdown", key: TEMPLATE_RUNNER_KEY, options: translatedLabels(TEMPLATE_RUNNER_LABELS) },
			},
		],
	};
}

export function periodGroups(): SettingDefinitionGroup[] {
	return PERIODS.map((period) => ({
		type: "group" as const,
		heading: t(PERIOD_LABELS[period]),
		items: [
			{ name: t("periodEnabled"), desc: t("periodEnabledDesc"), control: { type: "toggle" as const, key: periodKey(period, "enabled") } },
			{
				name: t("folder"),
				desc: t("folderDesc"),
				control: { type: "folder" as const, key: periodKey(period, "folder"), includeRoot: true },
			},
			{
				name: t("nameFormat"),
				desc: t("nameFormatDesc"),
				control: { type: "text" as const, key: periodKey(period, "format"), validate: formatError },
			},
			{
				name: t("template"),
				desc: t("templateDesc"),
				control: { type: "file" as const, key: periodKey(period, "template"), filter: (file: TFile) => file.extension === "md" },
			},
		],
	}));
}
