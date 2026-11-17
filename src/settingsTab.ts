import { Notice, PluginSettingTab, debounce } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { t, translatedLabels } from "./i18n/index.ts";
import type { TranslationKey } from "./i18n/index.ts";
import type DateCompassPlugin from "./main.ts";
import type { ParserLanguage, DayMonthOrder, NextWeekdayMeaning, WeekStart } from "./settings.ts";
import {
	DAY_MONTH_ORDER_KEY,
	INSERTION_ALIAS_SHAPE_KEY,
	MENTIONS_ENABLED_KEY,
	MENTIONS_TRIGGER_KEY,
	NEXT_WEEKDAY_KEY,
	WEEK_START_KEY,
	isActionKey,
	isTypedActionKey,
	readControl,
	writeControl,
} from "./settings/controlKeys.ts";
import { ResetSettingsModal } from "./settings/resetModal.ts";
import { mismatchGroups, periodGroups, templateRunnerGroup } from "./settings/dateNotesPage.ts";
import { copyFromSource, dateNoteMismatches } from "./dateNotes/import.ts";
import type { DateNoteSource } from "./dateNotes/import.ts";
import { enabledExternalDateNotes } from "./dateNotes/obsidianHost.ts";
import { mentionGroups } from "./settings/mentionsPage.ts";
import { insertionGroups } from "./settings/insertionPage.ts";
import { sameTriggerPlugins } from "./mentions/conflicts.ts";
import { enabledPluginsWithTriggers } from "./mentions/obsidianHost.ts";
import { actionsPage } from "./settings/actionsPage.ts";
import { renderLanguagePicker } from "./settings/languagePicker.ts";
import { pagePath } from "./settings/pages.ts";

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

const CONTROLS_THAT_SHOW_OR_HIDE_ITEMS = [MENTIONS_ENABLED_KEY, INSERTION_ALIAS_SHAPE_KEY];

const TYPING_PAUSE_MS = 800;

interface AppWithSettingModal {
	setting?: { openPagePath?: (tabId: string, path: string[]) => unknown };
}

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
				heading: t("localizationSection"),
				items: [
					{
						name: t("parserLanguages"),
						desc: t("parserLanguagesDesc"),
						render: (setting) =>
							renderLanguagePicker(setting, {
								languages: () => this.plugin.settings.languages,
								change: (languages) => void this.changeLanguages(languages),
							}),
					},
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
					sectionPage("insertionSection", "insertionSectionDesc", insertionGroups(() => this.plugin.settings.insertion)),
					actionsPage({
						actions: () => this.plugin.settings.actions,
						write: (key, value) => void this.setControlValue(key, value),
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeActions(mutate),
					}),
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

	private async changeLanguages(languages: ParserLanguage[]): Promise<void> {
		this.plugin.settings.languages = languages;
		await this.plugin.saveSettings();
		this.update();
	}

	private async changeActions(mutate: () => unknown): Promise<void> {
		mutate();
		await this.plugin.saveSettings();
		this.update();
	}

	private openPage(pageId: string): void {
		const modal = (this.app as App & AppWithSettingModal).setting;
		if (typeof modal?.openPagePath !== "function") {
			new Notice(t("needsNewerObsidian"));
			return;
		}
		modal.openPagePath(this.plugin.manifest.id, pagePath(this.getSettingDefinitions(), pageId) ?? [pageId]);
	}

	getControlValue(key: string): unknown {
		return readControl(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!writeControl(this.plugin.settings, key, value)) return;
		await this.plugin.saveSettings();
		if (CONTROLS_THAT_SHOW_OR_HIDE_ITEMS.includes(key)) this.update();
		else if (key === MENTIONS_TRIGGER_KEY) this.updateAfterTyping();
		else if (isTypedActionKey(key)) this.updateAfterTyping();
		else if (isActionKey(key)) this.update();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.resetSettings();
		await this.plugin.saveSettings();
		this.update();
	}
}
