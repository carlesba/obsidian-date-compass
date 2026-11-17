import { MarkdownView, Plugin, getLanguage } from "obsidian";
import { DEFAULT_LANGUAGE, setLanguage, t } from "./i18n/index.ts";
import { defaultSettings, mergeSettings } from "./settings.ts";
import type { DateCompassSettings } from "./settings.ts";
import { DateCompassSettingTab } from "./settingsTab.ts";
import { registerDateNoteCommands } from "./dateNotes/commands.ts";
import { importDateNotes } from "./dateNotes/import.ts";
import { installedExternalDateNotes } from "./dateNotes/obsidianHost.ts";
import { OpenDateNoteByPhraseModal } from "./dateNotes/phraseModal.ts";
import { DateMentionSuggest } from "./mentions/suggest.ts";
import { destinationInActiveEditor, noticeNoProperty } from "./insertion/obsidianHost.ts";
import { openInsertDatesModal } from "./sequence/modal.ts";
import { ActionCommands } from "./actions/commands.ts";
import { canRunAction, runActionInActiveNote } from "./actions/ask.ts";
import { createObsidianDateCompassApi } from "./api/obsidianHost.ts";

export default class DateCompassPlugin extends Plugin {
	settings: DateCompassSettings = defaultSettings();
	readonly api = createObsidianDateCompassApi(this.app, () => this.settings);
	private interfaceLanguage = DEFAULT_LANGUAGE;
	private readonly actionCommands = new ActionCommands(this, ({ id, name, action }) => ({
		id,
		name,
		checkCallback: (checking) => {
			if (!canRunAction(this.app)) return false;
			if (!checking) void runActionInActiveNote(this.app, () => this.settings, action);
			return true;
		},
	}));

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
		this.addCommand({
			id: "open-date-note-by-phrase",
			name: t("openDateNoteByPhrase"),
			callback: () => new OpenDateNoteByPhraseModal(this.app, () => this.settings).open(),
		});
		this.addCommand({
			id: "insert-date-sequence",
			name: t("insertDates"),
			editorCallback: (editor, context) => {
				const { file } = context;
				if (!file || !(context instanceof MarkdownView)) return;
				const destination = destinationInActiveEditor(context);
				if (destination.kind === "frontmatterWithoutProperty") noticeNoProperty();
				else openInsertDatesModal(() => this.settings, { app: this.app, editor, file, destination }, "");
			},
		});
		this.registerEditorSuggest(new DateMentionSuggest(this.app, () => this.settings));
		this.actionCommands.sync(this.settings.actions);
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
		this.actionCommands.sync(this.settings.actions);
	}
}
