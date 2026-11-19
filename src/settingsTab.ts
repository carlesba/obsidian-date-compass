import { Menu, Notice, PluginSettingTab, debounce } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { t } from "./i18n/index.ts";
import type { TranslationKey } from "./i18n/index.ts";
import type DateCompassPlugin from "./main.ts";
import type { ParserLanguage } from "./settings.ts";
import { commandPageRefresh, decoratorPageRefresh, mentionKeyParts, periodKey, readControl, writeControl } from "./settings/controlKeys.ts";
import type { MentionControlField, PageRefresh } from "./settings/controlKeys.ts";
import { ResetSettingsModal } from "./settings/resetModal.ts";
import { mismatchGroups, periodGroups, templateRunnerGroup, weekStartMismatchGroup } from "./settings/dateNotesPage.ts";
import { calendarPage } from "./settings/calendarPage.ts";
import type { Choice } from "./settings/calendarPage.ts";
import { localeWeekRule } from "./calendar/obsidianHost.ts";
import { weekRuleOf, weekStartDisagreesWithFormat } from "./calendar/weeks.ts";
import { copyFromSource, dateNoteMismatches } from "./dateNotes/import.ts";
import type { DateNoteSource } from "./dateNotes/import.ts";
import { enabledExternalDateNotes, obsidianMoment } from "./dateNotes/obsidianHost.ts";
import { PERIODS } from "./dateNotes/periods.ts";
import { mentionsPage } from "./settings/mentionsPage.ts";
import type { LinkStyleHost } from "./settings/linkStylePage.ts";
import type { SampleHost } from "./settings/todaySample.ts";
import { clashWarning, triggerClashes } from "./mentions/clashes.ts";
import type { TriggerClash } from "./mentions/clashes.ts";
import { enabledPluginsWithTriggers, slashCommandsEnabled } from "./mentions/obsidianHost.ts";
import type { Mention } from "./mentions/settings.ts";
import { commandsPage } from "./settings/commandsPage.ts";
import { localizationPage } from "./settings/localizationPage.ts";
import { pagePath } from "./settings/pages.ts";
import { renderFilter } from "./settings/filterEditor.ts";
import { createFilterVault, propertySuggestions, propertyTypesOf } from "./filters/obsidianVault.ts";
import type { PropertySuggestion } from "./filters/obsidianVault.ts";
import { ComboboxPopover } from "./settings/combobox.ts";

const MENTION_FIELDS_THAT_CHANGE_THE_PAGE: readonly MentionControlField[] = ["targets", "aliasShape"];

const PERIOD_ENABLED_KEYS: readonly string[] = PERIODS.map((period) => periodKey(period, "enabled"));

const WEEK_FORMAT_KEY = periodKey("week", "format");

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
	private readonly showTriggerAfterTyping = debounce((mentionId: string) => this.showTypedTrigger(mentionId), TYPING_PAUSE_MS, true);
	private readonly warnedTriggers = new Map<string, string>();

	constructor(app: App, plugin: DateCompassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const propertyTypes = propertyTypesOf(this.app);
		let suggestedProperties: PropertySuggestion[] | undefined;
		const suggestProperties = () => (suggestedProperties ??= propertySuggestions(createFilterVault(this.app), propertyTypes));
		return [
			{
				type: "group",
				items: [
					localizationPage({
						...this.sampleHost(),
						languages: () => this.plugin.settings.languages,
						dayMonthOrder: () => this.plugin.settings.dayMonthOrder,
						changeLanguages: (languages) => void this.changeLanguages(languages),
						chooseLanguage: (anchor, choices, pick) => {
							const menu = new Menu();
							for (const choice of choices) menu.addItem((item) => item.setTitle(choice.name).onClick(() => pick(choice.language)));
							const box = anchor.getBoundingClientRect();
							menu.showAtPosition({ x: box.left, y: box.bottom });
						},
						notify: (message) => new Notice(message),
					}),
					sectionPage("dateNotesSection", "dateNotesSectionDesc", this.dateNotesItems()),
					calendarPage({
						decorators: () => this.plugin.settings.calendar.decorators,
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeEntries(mutate),
						write: (key, value) => void this.setControlValue(key, value),
						notify: (message) => new Notice(message),
						choose: (anchor, choices, pick) => this.choose(anchor, choices, pick),
						search: (anchor, choices, typedChoice, pick) => this.search(anchor, choices, typedChoice, pick),
						propertyNames: () => suggestProperties().map((suggestion) => suggestion.name),
						propertyTypes: () => propertyTypes,
						renderFilter: (settingEl, filter) =>
							renderFilter(settingEl, filter, {
								app: this.app,
								propertyTypes,
								propertySuggestions: suggestProperties,
								chooseField: (anchor, choices, pick) => this.choose(anchor, choices, pick),
								change: (mutate) => void this.changeEntries(mutate),
							}),
					}),
					mentionsPage({
						...this.linkStyleHost(),
						mentions: () => this.plugin.settings.mentions,
						clashesOf: (mention) => this.clashesOf(mention),
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeEntries(mutate),
					}),
					commandsPage({
						...this.linkStyleHost(),
						commands: () => this.plugin.settings.commands,
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeEntries(mutate),
						ribbon: {
							listed: () => this.plugin.settings.ribbonButtons,
							source: () => this.plugin.settings,
							appliesLive: () => this.plugin.ribbonAppliesLive(),
							change: (listed) => void this.changeEntries(() => (this.plugin.settings.ribbonButtons = listed)),
							choose: (anchor, choices, pick) => this.choose(anchor, choices, pick),
							notify: (message) => new Notice(message),
						},
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

	private sampleHost(): SampleHost {
		return { today: () => obsidianMoment(), write: (key, value) => void this.setControlValue(key, value) };
	}

	private dateNotesItems(): SettingDefinitionItem[] {
		const mismatches = dateNoteMismatches(this.plugin.settings.dateNotes, enabledExternalDateNotes(this.app));
		return [
			...mismatchGroups(mismatches, (source) => void this.copyDateNotesFrom(source)),
			weekStartMismatchGroup(() => this.weekStartDisagreesWithWeekFormat()),
			templateRunnerGroup(),
			...periodGroups(),
		];
	}

	private weekStartDisagreesWithWeekFormat(): boolean {
		const { weekStart, dateNotes } = this.plugin.settings;
		const { enabled, format } = dateNotes.periods.week;
		const locale = localeWeekRule();
		return enabled && weekStartDisagreesWithFormat(weekRuleOf(weekStart, locale), format, locale);
	}

	private linkStyleHost(): LinkStyleHost {
		return {
			...this.sampleHost(),
			isEnabledInDateNotes: (period) => this.plugin.settings.dateNotes.periods[period].enabled,
			chooseTarget: (anchor, choices, pick) => {
				const menu = new Menu();
				for (const choice of choices) menu.addItem((item) => item.setTitle(choice.name).onClick(() => pick(choice.period)));
				const box = anchor.getBoundingClientRect();
				menu.showAtPosition({ x: box.left, y: box.bottom });
			},
			notify: (message) => new Notice(message),
		};
	}

	private choose<Value extends string>(anchor: HTMLElement, choices: Choice<Value>[], pick: (value: Value) => void): void {
		const menu = new Menu();
		for (const choice of choices) menu.addItem((item) => item.setTitle(choice.name).onClick(() => pick(choice.value)));
		const box = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: box.left, y: box.bottom });
	}

	private search(anchor: HTMLElement, choices: Choice<string>[], typedChoice: (query: string) => Choice<string> | undefined, pick: (value: string) => void): void {
		const popover: ComboboxPopover = new ComboboxPopover(
			anchor,
			{
				items: () => choices.map((choice) => ({ value: choice.value, label: choice.name })),
				searchPlaceholder: t("filterSearch"),
				extraItem: (query) => {
					const choice = typedChoice(query);
					return choice && { value: choice.value, label: choice.name };
				},
			},
			undefined,
			"",
			{
				choose: (item) => {
					popover.destroy();
					pick(item.value);
				},
				dismiss: () => popover.destroy(),
			},
		);
	}

	private clashesOf(mention: Mention): TriggerClash[] {
		return triggerClashes(mention, this.plugin.settings.mentions, enabledPluginsWithTriggers(this.app), slashCommandsEnabled(this.app));
	}

	private showTypedTrigger(mentionId: string): void {
		this.update();
		const mention = this.plugin.settings.mentions.find((candidate) => candidate.id === mentionId);
		const warning = mention && clashWarning(this.clashesOf(mention));
		if (!mention || !warning) {
			this.warnedTriggers.delete(mentionId);
			return;
		}
		if (this.warnedTriggers.get(mentionId) === mention.trigger) return;
		this.warnedTriggers.set(mentionId, mention.trigger);
		new Notice(warning);
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

	private async changeEntries(mutate: () => unknown): Promise<void> {
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
		const mentionKey = mentionKeyParts(key);
		if (mentionKey?.field === "trigger") this.showTriggerAfterTyping(mentionKey.mentionId);
		else if (mentionKey && MENTION_FIELDS_THAT_CHANGE_THE_PAGE.includes(mentionKey.field)) this.update();
		else if (PERIOD_ENABLED_KEYS.includes(key)) this.update();
		else if (key === WEEK_FORMAT_KEY) this.updateAfterTyping();
		else this.refreshCommandPage(commandPageRefresh(key) ?? decoratorPageRefresh(key));
	}

	private refreshCommandPage(refresh: PageRefresh | undefined): void {
		if (refresh === "now") this.update();
		else if (refresh === "afterTyping") this.updateAfterTyping();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.resetSettings();
		await this.plugin.saveSettings();
		this.update();
	}
}
