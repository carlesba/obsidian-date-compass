import { MarkdownView, Notice } from "obsidian";
import type { App, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { ChoosingSuggestModal, DateNotePickerModal } from "../dateNotes/phraseModal.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import { markdownLinkTo, unsavedFile } from "../mentions/obsidianHost.ts";
import type { NoteRef } from "../mentions/rows.ts";
import { DatesModal } from "../sequence/modal.ts";
import type { DateCompassSettings } from "../settings.ts";
import { runAction } from "./run.ts";
import type { ActionHost, Answer, RunOutcome } from "./run.ts";
import { questionOf, yesNoChoices } from "./settings.ts";
import type { ActionInput, DateAction, YesNoChoice } from "./settings.ts";

const YES_NO_LABELS = { yes: "answerYes", no: "answerNo", skip: "skipQuestion" } as const;

class YesNoModal extends ChoosingSuggestModal<YesNoChoice> {
	private readonly input: ActionInput;
	private readonly choose: (choice: YesNoChoice) => void;

	constructor(app: App, input: ActionInput, choose: (choice: YesNoChoice) => void, dismissed: () => void) {
		super(app, dismissed);
		this.input = input;
		this.choose = choose;
		this.setPlaceholder(questionOf(input));
	}

	getSuggestions(query: string): YesNoChoice[] {
		const typed = query.trim().toLowerCase();
		return yesNoChoices(this.input).filter((choice) => t(YES_NO_LABELS[choice]).toLowerCase().startsWith(typed));
	}

	renderSuggestion(choice: YesNoChoice, el: HTMLElement): void {
		el.setText(t(YES_NO_LABELS[choice]));
	}

	onChooseSuggestion(choice: YesNoChoice): void {
		this.choose(choice);
	}
}

function ask(app: App, settings: () => DateCompassSettings, input: ActionInput): Promise<Answer | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		const answer = (value: Answer | undefined) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		const dismissed = () => answer(undefined);
		if (input.type === "yesNo") {
			new YesNoModal(app, input, (choice) => answer(choice === "skip" ? { kind: "skipped" } : { kind: "yesNo", yes: choice === "yes" }), dismissed).openWithQuery("");
			return;
		}
		if (input.type === "dates") {
			new DatesModal(
				app,
				settings,
				{ title: questionOf(input), initialText: input.defaultText, optional: input.optional },
				(preview) => {
					if (preview.kind === "dates") answer({ kind: "notes", notes: preview.notes });
					else if (preview.kind === "empty" && input.optional) answer({ kind: "skipped" });
					else return false;
					return true;
				},
				dismissed,
			).open();
			return;
		}
		new DateNotePickerModal(app, settings, {
			placeholder: questionOf(input),
			allows: input.type === "date" ? (period) => period === "day" : () => true,
			offersCurrentNotes: input.type === "periodicNote",
			optional: input.optional,
			choose: (picked) => answer(picked.kind === "skip" ? { kind: "skipped" } : { kind: "notes", notes: picked.row.notes }),
			dismissed,
		}).openWithQuery(input.defaultText);
	});
}

export function obsidianActionHost(app: App, settings: () => DateCompassSettings, file: TFile): ActionHost {
	return {
		ask: (input) => ask(app, settings, input),
		linkTo: (note: NoteRef) => markdownLinkTo(app, note.path, file.path, undefined),
		propertyLinkTo: (note: NoteRef) => `[[${app.metadataCache.fileToLinktext(app.vault.getFileByPath(note.path) ?? unsavedFile(note.path), file.path, true)}]]`,
		processFrontMatter: (change) => app.fileManager.processFrontMatter(file, change),
		notify: (message) => new Notice(message),
	};
}

const OUTCOME_NOTICES: Partial<Record<RunOutcome, "actionNothingToWrite" | "actionNeedsEditor" | "actionHasNoCompleteWrite">> = {
	nothingToWrite: "actionNothingToWrite",
	noCompleteWrite: "actionHasNoCompleteWrite",
	noEditor: "actionNeedsEditor",
};

export function canRunAction(app: App): boolean {
	return app.workspace.getActiveViewOfType(MarkdownView)?.file != null;
}

export async function runActionInActiveNote(app: App, settings: () => DateCompassSettings, action: DateAction): Promise<void> {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!view || !file) return;
	const host = obsidianActionHost(app, settings, file);
	const { dateNotes, insertSequence, mentions } = settings();
	try {
		const outcome = await runAction(action, host, {
			periods: dateNotes.periods,
			moment: obsidianMoment,
			insertSequence,
			separator: mentions.separator,
			editor: view.editor,
		});
		const notice = OUTCOME_NOTICES[outcome];
		if (notice) host.notify(t(notice));
	} catch (error) {
		host.notify(t("actionFailed", { error: error instanceof Error ? error.message : String(error) }));
	}
}
