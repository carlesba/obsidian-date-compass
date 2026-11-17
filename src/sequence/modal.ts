import { Modal } from "obsidian";
import type { App, Editor } from "obsidian";
import { t } from "../i18n/index.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import { markdownLinkTo } from "../mentions/obsidianHost.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { DateCompassSettings } from "../settings.ts";
import { insertAtCursor, previewSequence } from "./preview.ts";
import type { SequencePreview } from "./preview.ts";

export interface DatesQuestion {
	title: string;
	initialText: string;
	optional: boolean;
}

export class DatesModal extends Modal {
	private readonly settings: () => DateCompassSettings;
	private readonly question: DatesQuestion;
	private readonly accept: (preview: SequencePreview) => boolean;
	private readonly closed: () => void;
	private preview: SequencePreview = { kind: "empty" };

	constructor(app: App, settings: () => DateCompassSettings, question: DatesQuestion, accept: (preview: SequencePreview) => boolean, closed: () => void = () => undefined) {
		super(app);
		this.settings = settings;
		this.question = question;
		this.accept = accept;
		this.closed = closed;
	}

	onOpen(): void {
		this.setTitle(this.question.title);
		const input = this.contentEl.createEl("input", { type: "text", attr: { placeholder: t("sequencePlaceholder") } });
		const previewEl = this.contentEl.createDiv();
		const showPreview = () => {
			this.preview = previewSequence(input.value, obsidianRowContext(this.settings()));
			previewEl.setText(this.preview.kind === "empty" ? (this.question.optional ? t("emptySkipsQuestion") : "") : this.preview.text);
		};
		input.value = this.question.initialText;
		showPreview();
		input.addEventListener("input", showPreview);
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.isComposing) return;
			event.preventDefault();
			if (this.accept(this.preview)) this.close();
		});
		input.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		this.closed();
	}
}

export class InsertDateSequenceModal extends DatesModal {
	constructor(app: App, editor: Editor, sourcePath: string, settings: () => DateCompassSettings) {
		super(app, settings, { title: t("insertDateSequence"), initialText: "", optional: false }, (preview) => {
			const { insertSequence, mentions } = settings();
			const linkTo = (note: NoteRef) => markdownLinkTo(app, note.path, sourcePath, undefined);
			return insertAtCursor(editor, preview, linkTo, insertSequence, mentions.separator);
		});
	}
}
