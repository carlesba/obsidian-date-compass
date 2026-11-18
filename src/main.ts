import { Plugin, getLanguage } from "obsidian";
import { DEFAULT_LANGUAGE, setLanguage, t } from "./i18n/index.ts";
import { defaultSettings, mergeSettings } from "./settings.ts";
import type { DateCompassSettings } from "./settings.ts";
import { DateCompassSettingTab } from "./settingsTab.ts";
import { registerDateNoteCommands } from "./dateNotes/commands.ts";
import { importDateNotes } from "./dateNotes/import.ts";
import { installedExternalDateNotes } from "./dateNotes/obsidianHost.ts";
import { OpenDateNoteByPhraseModal } from "./dateNotes/phraseModal.ts";
import { DateMentionSuggest } from "./mentions/suggest.ts";
import { PaletteCommands } from "./commands/palette.ts";
import { canRunPropertyCommand, runCursorCommand, runPropertyCommand } from "./commands/ask.ts";
import { createObsidianDateCompassApi } from "./api/obsidianHost.ts";
import { refreshCalendars, registerCalendar } from "./calendar/commands.ts";

export default class DateCompassPlugin extends Plugin {
	settings: DateCompassSettings = defaultSettings();
	readonly api = createObsidianDateCompassApi(this.app, () => this.settings);
	private interfaceLanguage = DEFAULT_LANGUAGE;
	private readonly paletteCommands = new PaletteCommands(this, ({ id, name, needsEditor, command }) =>
		needsEditor
			? {
					id,
					name,
					editorCheckCallback: (checking, editor, context) => {
						if (!checking) void runCursorCommand(this.app, () => this.settings, command, editor, context.file ?? undefined);
						return true;
					},
				}
			: {
					id,
					name,
					checkCallback: (checking) => {
						if (!canRunPropertyCommand(this.app)) return false;
						if (!checking) void runPropertyCommand(this.app, () => this.settings, command);
						return true;
					},
				},
	);

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
		registerCalendar(this, () => this.settings);
		this.addCommand({
			id: "open-date-note-by-phrase",
			name: t("openDateNoteByPhrase"),
			callback: () => new OpenDateNoteByPhraseModal(this.app, () => this.settings).open(),
		});
		this.registerEditorSuggest(new DateMentionSuggest(this.app, () => this.settings));
		this.paletteCommands.sync(this.settings.commands);
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
		this.paletteCommands.sync(this.settings.commands);
		refreshCalendars(this.app);
	}
}
