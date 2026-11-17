import { Modal } from "obsidian";
import type { App, Editor } from "obsidian";
import { t } from "../i18n/index.ts";
import { phraseRowContext } from "../dateNotes/phraseModal.ts";
import { markdownLinkTo } from "../mentions/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { previewSequence, sequenceInsertion } from "./preview.ts";
import type { SequencePreview } from "./preview.ts";

export class InsertDateSequenceModal extends Modal {
	private readonly editor: Editor;
	private readonly sourcePath: string;
	private readonly settings: () => DateCompassSettings;
	private preview: SequencePreview = { kind: "empty" };

	constructor(app: App, editor: Editor, sourcePath: string, settings: () => DateCompassSettings) {
		super(app);
		this.editor = editor;
		this.sourcePath = sourcePath;
		this.settings = settings;
	}

	onOpen(): void {
		this.setTitle(t("insertDateSequence"));
		const input = this.contentEl.createEl("input", { type: "text", attr: { placeholder: t("sequencePlaceholder") } });
		const previewEl = this.contentEl.createDiv();
		input.addEventListener("input", () => {
			this.preview = previewSequence(input.value, phraseRowContext(this.settings()));
			previewEl.setText(this.preview.kind === "empty" ? "" : this.preview.text);
		});
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.isComposing) return;
			event.preventDefault();
			this.insertLinks();
		});
		input.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private insertLinks(): void {
		if (this.preview.kind !== "dates") return;
		const settings = this.settings();
		const links = this.preview.notes.map((note) => markdownLinkTo(this.app, note.path, this.sourcePath, undefined));
		const cursor = this.editor.getCursor("from");
		const textBeforeCursor = this.editor.getLine(cursor.line).slice(0, cursor.ch);
		this.editor.replaceSelection(sequenceInsertion(links, settings.insertSequence, settings.mentions.separator, textBeforeCursor));
		this.close();
	}
}
