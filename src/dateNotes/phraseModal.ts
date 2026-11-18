import { Platform, SuggestModal } from "obsidian";
import type { App } from "obsidian";
import { phrasePickerTextOf, pickerNoteTextOf } from "../commands/pickerText.ts";
import { t } from "../i18n/index.ts";
import { buildRows, rowLabel, singleNoteRows } from "../mentions/rows.ts";
import type { DateRow } from "../mentions/rows.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import type { DateCompassSettings } from "../settings.ts";
import { openDateNote } from "./commands.ts";
import type { Period } from "./periods.ts";
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
	note?: string;
	targets?: readonly Period[];
	aliasWithAltEnter?: boolean;
	choose: (row: DateRow, event: MouseEvent | KeyboardEvent) => void;
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
		const noteText = pickerNoteTextOf(options);
		if (noteText) this.resultContainerEl.before(createDiv({ cls: "date-compass-picker-note", text: noteText }));
		this.emptyStateText = t("phraseNoMatch");
		if (options.aliasWithAltEnter) this.chooseWithAliasOnAltEnter();
	}

	private chooseWithAliasOnAltEnter(): void {
		this.scope.register(["Alt"], "Enter", (event) => {
			this.selectActiveSuggestion(event);
			return false;
		});
		if (Platform.isMobile) return;
		this.setInstructions([
			{ command: "↵", purpose: t("instructionInsertLink") },
			{ command: "⌥↵", purpose: t("instructionWithAlias") },
			{ command: "esc", purpose: t("instructionDismiss") },
		]);
	}

	getSuggestions(query: string): DateRow[] {
		return singleNoteRows(buildRows(query, obsidianRowContext(this.settings(), this.options.targets)));
	}

	renderSuggestion(row: DateRow, el: HTMLElement): void {
		el.setText(rowLabel(row, obsidianMoment()));
	}

	onChooseSuggestion(row: DateRow, event: MouseEvent | KeyboardEvent): void {
		this.options.choose(row, event);
	}
}

export class OpenDateNoteByPhraseModal extends DateNotePickerModal {
	constructor(app: App, settings: () => DateCompassSettings) {
		super(app, settings, {
			...phrasePickerTextOf(),
			choose: (row) => {
				const [note] = row.notes;
				void openDateNote(app, settings().dateNotes, note.date, note.period);
			},
		});
	}
}
