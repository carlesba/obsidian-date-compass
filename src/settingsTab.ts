import { Menu, Notice, PluginSettingTab, debounce } from "obsidian";
import type { App, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import { t } from "./i18n/index.ts";
import type { TranslationKey } from "./i18n/index.ts";
import type DateCompassPlugin from "./main.ts";
import type { ParserLanguage } from "./settings.ts";
import { isCommandKey, isTypedCommandKey, mentionKeyParts, readControl, writeControl } from "./settings/controlKeys.ts";
import type { MentionControlField } from "./settings/controlKeys.ts";
import { ResetSettingsModal } from "./settings/resetModal.ts";
import { mismatchGroups, periodGroups, templateRunnerGroup } from "./settings/dateNotesPage.ts";
import { copyFromSource, dateNoteMismatches } from "./dateNotes/import.ts";
import type { DateNoteSource } from "./dateNotes/import.ts";
import { enabledExternalDateNotes, obsidianMoment } from "./dateNotes/obsidianHost.ts";
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

const MENTION_FIELDS_THAT_CHANGE_THE_PAGE: readonly MentionControlField[] = ["targets", "aliasShape"];

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
					mentionsPage({
						...this.linkStyleHost(),
						mentions: () => this.plugin.settings.mentions,
						clashesOf: (mention) => this.clashesOf(mention),
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeEntries(mutate),
					}),
					commandsPage({
						commands: () => this.plugin.settings.commands,
						openPage: (pageId) => this.openPage(pageId),
						change: (mutate) => this.changeEntries(mutate),
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
		return [...mismatchGroups(mismatches, (source) => void this.copyDateNotesFrom(source)), templateRunnerGroup(), ...periodGroups()];
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
		else if (isTypedCommandKey(key)) this.updateAfterTyping();
		else if (isCommandKey(key)) this.update();
	}

	private async resetSettings(): Promise<void> {
		this.plugin.resetSettings();
		await this.plugin.saveSettings();
		this.update();
	}
}
