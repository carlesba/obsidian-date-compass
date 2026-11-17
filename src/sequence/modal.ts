import { Modal, Setting } from "obsidian";
import type { App, Editor, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import { addDatesToProperty, obsidianLinks } from "../insertion/obsidianHost.ts";
import { effectiveDestination } from "../insertion/destination.ts";
import type { DatesDestination } from "../insertion/destination.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { DateCompassSettings } from "../settings.ts";
import { insertLinks, previewSequence } from "./preview.ts";
import type { InsertionRange, SequencePreview } from "./preview.ts";

export interface DatesQuestion {
	title: string;
	initialText: string;
	optional: boolean;
	propertyName?: string;
	replacesProperty?: boolean;
	links?: (notes: NoteRef[], phrase: string, withAlias: boolean) => string[];
	withAliasInitially?: boolean;
}

export type DatesAccept = (preview: SequencePreview, withAlias: boolean, phrase: string) => boolean;

export class DatesModal extends Modal {
	private readonly settings: () => DateCompassSettings;
	private readonly question: DatesQuestion;
	private readonly accept: DatesAccept;
	private readonly closed: () => void;
	private preview: SequencePreview = { kind: "empty" };
	private withAlias: boolean;

	constructor(app: App, settings: () => DateCompassSettings, question: DatesQuestion, accept: DatesAccept, closed: () => void = () => undefined) {
		super(app);
		this.settings = settings;
		this.question = question;
		this.accept = accept;
		this.closed = closed;
		this.withAlias = question.withAliasInitially ?? false;
	}

	onOpen(): void {
		this.setTitle(this.question.title);
		this.modalEl.addClass("date-compass-dates-modal");
		const input = this.contentEl.createEl("input", { type: "text", cls: "date-compass-dates-input", attr: { placeholder: t("sequencePlaceholder") } });
		if (this.question.propertyName !== undefined) this.contentEl.createDiv({ cls: "date-compass-dates-property", text: t(this.question.replacesProperty ? "datesReplaceProperty" : "datesToProperty", { name: this.question.propertyName }) });
		const previewEl = this.contentEl.createDiv({ cls: "date-compass-dates-reading" });
		const linksEl = this.contentEl.createDiv({ cls: "date-compass-dates-links" });
		const showPreview = () => {
			this.preview = previewSequence(input.value, obsidianRowContext(this.settings()));
			previewEl.setText(this.preview.kind === "empty" ? (this.question.optional ? t("emptySkipsQuestion") : "") : this.preview.text);
			linksEl.setText(this.linksLine(input.value));
		};
		if (this.question.links) {
			new Setting(this.contentEl).setName(t("withAlias")).setDesc(t("withAliasDesc")).addToggle((toggle) =>
				toggle.setValue(this.withAlias).onChange((checked) => {
					this.withAlias = checked;
					showPreview();
				}),
			);
		}
		new Setting(this.contentEl).addButton((button) => button.setButtonText(t("datesDone")).setCta().onClick(() => this.submit(input.value, this.withAlias)));
		input.value = this.question.initialText;
		showPreview();
		input.addEventListener("input", showPreview);
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.isComposing) return;
			event.preventDefault();
			this.submit(input.value, event.altKey && this.question.links ? !this.withAlias : this.withAlias);
		});
		input.focus();
	}

	private linksLine(phrase: string): string {
		if (!this.question.links || this.preview.kind !== "dates") return "";
		return this.question.links(this.preview.notes, phrase.trim(), this.withAlias).join(", ");
	}

	private submit(phrase: string, withAlias: boolean): void {
		if (this.accept(this.preview, withAlias, phrase.trim())) this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		this.closed();
	}
}

export interface InsertDatesTarget {
	app: App;
	editor: Editor;
	file?: TFile;
	destination: DatesDestination;
	range?: InsertionRange;
}

export function openInsertDatesModal(settings: () => DateCompassSettings, target: InsertDatesTarget, initialText: string): void {
	const { app, editor, file, range } = target;
	const destination = effectiveDestination(target.destination, file !== undefined);
	const linksOf = (notes: NoteRef[], phrase: string, withAlias: boolean) => obsidianLinks(app, file?.path ?? "", settings())(notes, phrase, withAlias);
	const propertyTarget = destination.kind === "property" && file ? { name: destination.name, file } : undefined;
	new DatesModal(
		app,
		settings,
		propertyTarget
			? { title: t("insertDates"), initialText, optional: false, propertyName: propertyTarget.name }
			: { title: t("insertDates"), initialText, optional: false, links: linksOf, withAliasInitially: settings().insertion.aliasByDefault },
		(preview, withAlias, phrase) => {
			if (preview.kind !== "dates") return false;
			if (propertyTarget) addDatesToProperty(app, editor, propertyTarget.file, propertyTarget.name, preview.notes, range);
			else insertLinks(editor, linksOf(preview.notes, phrase, withAlias), settings().insertion.separator, range);
			return true;
		},
	).open();
}
