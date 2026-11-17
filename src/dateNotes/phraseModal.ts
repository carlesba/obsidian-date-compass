import { SuggestModal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";
import { buildRows, rowLabel, singleNoteRows } from "../mentions/rows.ts";
import type { DateRow } from "../mentions/rows.ts";
import { localeParseOptions } from "../obsidianParseOptions.ts";
import type { DateCompassSettings } from "../settings.ts";
import { openDateNote } from "./commands.ts";
import { obsidianMoment } from "./obsidianHost.ts";

export class OpenDateNoteByPhraseModal extends SuggestModal<DateRow> {
	private readonly settings: () => DateCompassSettings;

	constructor(app: App, settings: () => DateCompassSettings) {
		super(app);
		this.settings = settings;
		this.setPlaceholder(t("phrasePlaceholder"));
		this.emptyStateText = t("phraseNoMatch");
	}

	getSuggestions(query: string): DateRow[] {
		const settings = this.settings();
		const rows = buildRows(query, {
			now: obsidianMoment(),
			moment: obsidianMoment,
			options: localeParseOptions(settings),
			periods: settings.dateNotes.periods,
			allows: () => true,
		});
		return singleNoteRows(rows);
	}

	renderSuggestion(row: DateRow, el: HTMLElement): void {
		el.setText(rowLabel(row, obsidianMoment()));
	}

	onChooseSuggestion(row: DateRow): void {
		const [note] = row.notes;
		void openDateNote(this.app, this.settings().dateNotes, note.date, note.period);
	}
}
