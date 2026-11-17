import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { t, translatedLabels } from "./i18n/index.ts";
import type { TranslationKey } from "./i18n/index.ts";
import type DateCompassPlugin from "./main.ts";
import { PARSER_LANGUAGES } from "./settings.ts";
import type { DayMonthOrder, NextWeekdayMeaning, ParserLanguage, WeekStart } from "./settings.ts";
import { DAY_MONTH_ORDER_KEY, NEXT_WEEKDAY_KEY, WEEK_START_KEY, languageKey, readControl, writeControl } from "./settings/controlKeys.ts";
import { ResetSettingsModal } from "./settings/resetModal.ts";

const LANGUAGE_NAMES: Record<ParserLanguage, TranslationKey> = {
	en: "languageEnglish",
	es: "languageSpanish",
};

const WEEK_START_LABELS: Record<WeekStart, TranslationKey> = {
	locale: "weekStartLocale",
	monday: "weekStartMonday",
	sunday: "weekStartSunday",
};

const NEXT_WEEKDAY_LABELS: Record<NextWeekdayMeaning, TranslationKey> = {
	nextWeek: "nextWeekdayNextWeek",
	nextOccurrence: "nextWeekdayNextOccurrence",
};

const DAY_MONTH_ORDER_LABELS: Record<DayMonthOrder, TranslationKey> = {
	dayMonth: "dayMonthOrderDayMonth",
	monthDay: "dayMonthOrderMonthDay",
};

function sectionPage(name: TranslationKey, desc: TranslationKey): SettingDefinitionPage {
	return { type: "page", name: t(name), desc: t(desc), items: [] };
}

export class DateCompassSettingTab extends PluginSettingTab {
	private readonly plugin: DateCompassPlugin;

	constructor(app: App, plugin: DateCompassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: t("parserLanguages"),
				items: PARSER_LANGUAGES.map((language) => ({
					name: t(LANGUAGE_NAMES[language]),
					desc: t("parserLanguagesDesc"),
					control: { type: "toggle" as const, key: languageKey(language) },
				})),
			},
			{
				type: "group",
				items: [
					{
						name: t("weekStart"),
						desc: t("weekStartDesc"),
						control: { type: "dropdown", key: WEEK_START_KEY, options: translatedLabels(WEEK_START_LABELS) },
					},
					{
						name: t("nextWeekday"),
						desc: t("nextWeekdayDesc"),
						control: { type: "dropdown", key: NEXT_WEEKDAY_KEY, options: translatedLabels(NEXT_WEEKDAY_LABELS) },
					},
					{
						name: t("dayMonthOrder"),
						desc: t("dayMonthOrderDesc"),
						control: { type: "dropdown", key: DAY_MONTH_ORDER_KEY, options: translatedLabels(DAY_MONTH_ORDER_LABELS) },
					},
				],
			},
			{
				type: "group",
				items: [
					sectionPage("dateNotesSection", "dateNotesSectionDesc"),
					sectionPage("mentionsSection", "mentionsSectionDesc"),
					sectionPage("insertSequenceSection", "insertSequenceSectionDesc"),
					sectionPage("actionsSection", "actionsSectionDesc"),
				],
			},
			{
				type: "group",
				items: [
					{
						name: t("resetAllSettings"),
						desc: t("resetAllSettingsDesc"),
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText(t("reset"))
									.setDestructive()
									.onClick(() => new ResetSettingsModal(this.app, () => void this.resetSettings()).open()),
							);
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return readControl(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!writeControl(this.plugin.settings, key, value)) return;
		await this.plugin.saveSettings();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.resetSettings();
		await this.plugin.saveSettings();
		this.update();
	}
}
