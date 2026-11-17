import { SuggestModal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";
import { buildRows, rowLabel, singleNoteRows } from "../mentions/rows.ts";
import type { DateRow } from "../mentions/rows.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import type { DateCompassSettings } from "../settings.ts";
import { openDateNote } from "./commands.ts";
import { obsidianMoment } from "./obsidianHost.ts";

export abstract class ChoosingSuggestModal<Choice> extends SuggestModal<Choice> {
	private chosen = false;
	private readonly dismissed: () => void;

	constructor(app: App, dismissed: () => void) {
		super(app);
		this.dismissed = dismissed;
	}

	openWithQuery(query: string): void {
		this.open();
		if (query === "") return;
		this.inputEl.value = query;
		this.inputEl.dispatchEvent(new Event("input"));
	}

	selectSuggestion(choice: Choice, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		super.selectSuggestion(choice, evt);
	}

	onClose(): void {
		if (!this.chosen) this.dismissed();
	}
}

export interface NotePickerOptions {
	placeholder: string;
	choose: (row: DateRow) => void;
	dismissed?: () => void;
}

export class DateNotePickerModal extends ChoosingSuggestModal<DateRow> {
	private readonly settings: () => DateCompassSettings;
	private readonly options: NotePickerOptions;

	constructor(app: App, settings: () => DateCompassSettings, options: NotePickerOptions) {
		super(app, options.dismissed ?? (() => undefined));
		this.settings = settings;
		this.options = options;
		this.setPlaceholder(options.placeholder);
		this.emptyStateText = t("phraseNoMatch");
	}

	getSuggestions(query: string): DateRow[] {
		return singleNoteRows(buildRows(query, obsidianRowContext(this.settings())));
	}

	renderSuggestion(row: DateRow, el: HTMLElement): void {
		el.setText(rowLabel(row, obsidianMoment()));
	}

	onChooseSuggestion(row: DateRow): void {
		this.options.choose(row);
	}
}

export class OpenDateNoteByPhraseModal extends DateNotePickerModal {
	constructor(app: App, settings: () => DateCompassSettings) {
		super(app, settings, {
			placeholder: t("phrasePlaceholder"),
			choose: (row) => {
				const [note] = row.notes;
				void openDateNote(app, settings().dateNotes, note.date, note.period);
			},
		});
	}
}
