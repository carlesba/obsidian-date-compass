import { SuggestModal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";
import { buildRows, rowLabel } from "../mentions/rows.ts";
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
		return buildRows(query, {
			now: obsidianMoment(),
			moment: obsidianMoment,
			options: localeParseOptions(settings),
			periods: settings.dateNotes.periods,
			allows: () => true,
		});
	}

	renderSuggestion(row: DateRow, el: HTMLElement): void {
		el.setText(rowLabel(row, obsidianMoment()));
	}

	onChooseSuggestion(row: DateRow): void {
		void openDateNote(this.app, this.settings().dateNotes, row.date, row.period);
	}
}
