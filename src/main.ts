import { Plugin, getLanguage } from "obsidian";
import { DEFAULT_LANGUAGE, setLanguage } from "./i18n/index.ts";
import { defaultSettings, mergeSettings } from "./settings.ts";
import type { DateCompassSettings } from "./settings.ts";
import { DateCompassSettingTab } from "./settingsTab.ts";
import { registerDateNoteCommands } from "./dateNotes/commands.ts";
import { importDateNotes } from "./dateNotes/import.ts";
import { installedExternalDateNotes } from "./dateNotes/obsidianHost.ts";

export default class DateCompassPlugin extends Plugin {
	settings: DateCompassSettings = defaultSettings();
	private interfaceLanguage = DEFAULT_LANGUAGE;

	async onload(): Promise<void> {
		try {
			this.interfaceLanguage = getLanguage();
		} catch {
			this.interfaceLanguage = DEFAULT_LANGUAGE;
		}
		setLanguage(this.interfaceLanguage);
		this.settings = mergeSettings(await this.loadData(), this.interfaceLanguage);
		this.addSettingTab(new DateCompassSettingTab(this.app, this));
		registerDateNoteCommands(this, () => this.settings.dateNotes);
		this.app.workspace.onLayoutReady(() => void this.importDateNotesOnce());
	}

	resetSettings(): void {
		const imported = this.settings.dateNotes.imported;
		this.settings = defaultSettings(this.interfaceLanguage);
		this.settings.dateNotes.imported = imported;
	}

	private async importDateNotesOnce(): Promise<void> {
		if (this.settings.dateNotes.imported) return;
		importDateNotes(this.settings.dateNotes, await installedExternalDateNotes(this.app));
		await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
