import { PluginSettingTab, debounce } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { t, translatedLabels } from "./i18n/index.ts";
import type { TranslationKey } from "./i18n/index.ts";
import type DateCompassPlugin from "./main.ts";
import { PARSER_LANGUAGES } from "./settings.ts";
import type { DayMonthOrder, NextWeekdayMeaning, ParserLanguage, WeekStart } from "./settings.ts";
import {
	DAY_MONTH_ORDER_KEY,
	MENTIONS_ALIAS_MODE_KEY,
	MENTIONS_ENABLED_KEY,
	MENTIONS_TRIGGER_KEY,
	NEXT_WEEKDAY_KEY,
	WEEK_START_KEY,
	languageKey,
	readControl,
	writeControl,
} from "./settings/controlKeys.ts";
import { ResetSettingsModal } from "./settings/resetModal.ts";
import { mismatchGroups, periodGroups, templateRunnerGroup } from "./settings/dateNotesPage.ts";
import { copyFromSource, dateNoteMismatches } from "./dateNotes/import.ts";
import type { DateNoteSource } from "./dateNotes/import.ts";
import { enabledExternalDateNotes } from "./dateNotes/obsidianHost.ts";
import { mentionGroups } from "./settings/mentionsPage.ts";
import { insertSequenceGroups } from "./settings/insertSequencePage.ts";
import { sameTriggerPlugins } from "./mentions/conflicts.ts";
import { enabledPluginsWithTriggers } from "./mentions/obsidianHost.ts";

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

const CONTROLS_THAT_SHOW_OR_HIDE_ITEMS = [MENTIONS_ENABLED_KEY, MENTIONS_ALIAS_MODE_KEY];

const TYPING_PAUSE_MS = 800;

function sectionPage(name: TranslationKey, desc: TranslationKey, items: SettingDefinitionItem[] = []): SettingDefinitionPage {
	return { type: "page", name: t(name), desc: t(desc), items };
}

export class DateCompassSettingTab extends PluginSettingTab {
	private readonly plugin: DateCompassPlugin;
	private readonly updateAfterTyping = debounce(() => this.update(), TYPING_PAUSE_MS, true);

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
					sectionPage("dateNotesSection", "dateNotesSectionDesc", this.dateNotesItems()),
					sectionPage("mentionsSection", "mentionsSectionDesc", this.mentionsItems()),
					sectionPage("insertSequenceSection", "insertSequenceSectionDesc", insertSequenceGroups()),
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

	private dateNotesItems(): SettingDefinitionItem[] {
		const mismatches = dateNoteMismatches(this.plugin.settings.dateNotes, enabledExternalDateNotes(this.app));
		return [...mismatchGroups(mismatches, (source) => void this.copyDateNotesFrom(source)), templateRunnerGroup(), ...periodGroups()];
	}

	private mentionsItems(): SettingDefinitionItem[] {
		const sameTrigger = sameTriggerPlugins(this.plugin.settings.mentions.trigger, enabledPluginsWithTriggers(this.app));
		return mentionGroups(() => this.plugin.settings.mentions, sameTrigger);
	}

	private async copyDateNotesFrom(source: DateNoteSource): Promise<void> {
		if (!copyFromSource(this.plugin.settings.dateNotes, source, enabledExternalDateNotes(this.app))) return;
		await this.plugin.saveSettings();
		this.update();
	}

	getControlValue(key: string): unknown {
		return readControl(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!writeControl(this.plugin.settings, key, value)) return;
		await this.plugin.saveSettings();
		if (CONTROLS_THAT_SHOW_OR_HIDE_ITEMS.includes(key)) this.update();
		else if (key === MENTIONS_TRIGGER_KEY) this.updateAfterTyping();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.resetSettings();
		await this.plugin.saveSettings();
		this.update();
	}
}
