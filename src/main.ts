import { Plugin, getLanguage } from "obsidian";
import { DEFAULT_LANGUAGE, setLanguage } from "./i18n/index.ts";
import { defaultSettings, mergeSettings } from "./settings.ts";
import type { DateCompassSettings } from "./settings.ts";
import { DateCompassSettingTab } from "./settingsTab.ts";

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
	}

	resetSettings(): void {
		this.settings = defaultSettings(this.interfaceLanguage);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
