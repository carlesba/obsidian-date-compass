import { EditorSuggest, Platform } from "obsidian";
import type { App, Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import { addDatesToProperty, destinationInActiveEditor, noticeNoProperty, obsidianLinks } from "../insertion/obsidianHost.ts";
import { insertLinks } from "../sequence/preview.ts";
import { openInsertDatesModal } from "../sequence/modal.ts";
import { buildRows, mayStillMatch, rowLabel } from "./rows.ts";
import type { DateRow, RowContext } from "./rows.ts";
import { isMoreRow, selectionIntent, withMoreRow } from "./selection.ts";
import type { Suggestion } from "./selection.ts";
import type { Mention } from "./settings.ts";
import { activeMentionAt, isDeadEnd, isDismissed, mayOpenMentionAt } from "./trigger.ts";
import type { Dismissal } from "./trigger.ts";

export class DateMentionSuggest extends EditorSuggest<Suggestion> {
	private readonly settings: () => DateCompassSettings;
	private dismissal: Dismissal | undefined;
	private rows: DateRow[] = [];
	private mention: Mention | undefined;

	constructor(app: App, settings: () => DateCompassSettings) {
		super(app);
		this.settings = settings;
		this.showInstructions();
		this.scope.register(["Shift"], "Enter", (event) => this.chooseSelectedWith(event));
		this.scope.register(["Alt"], "Enter", (event) => this.chooseSelectedWith(event));
	}

	private chooseSelectedWith(event: KeyboardEvent): boolean {
		const chooser = (this as unknown as { suggestions?: { useSelectedItem?: (event: KeyboardEvent) => void } }).suggestions;
		chooser?.useSelectedItem?.(event);
		return false;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		this.rows = [];
		this.mention = undefined;
		if (!file) return null;
		const lineBeforeCaret = editor.getLine(cursor.line).slice(0, cursor.ch);
		const active = activeMentionAt(lineBeforeCaret, this.settings().mentions);
		if (!active) {
			this.dismissal = undefined;
			return null;
		}
		const { mention, match } = active;
		const start = { line: cursor.line, ch: match.start };
		const position = positionKey(file, start, mention);
		if (isDismissed(this.dismissal, position, match.query)) return null;
		if (!mayOpenMentionAt(linesOf(editor), cursor.line, lineBeforeCaret)) return null;
		const rowContext = this.rowContext(mention);
		const rows = buildRows(match.query, rowContext);
		if (rows.length === 0 && isDeadEnd(match.query, (text) => mayStillMatch(text, rowContext))) {
			this.dismissal = { position, deadEndQuery: match.query };
			return null;
		}
		this.rows = rows;
		this.mention = mention;
		return { start, end: cursor, query: match.query };
	}

	getSuggestions(): Suggestion[] {
		return withMoreRow(this.rows);
	}

	renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
		el.setText(isMoreRow(suggestion) ? t("moreRow") : rowLabel(suggestion, obsidianMoment()));
	}

	selectSuggestion(suggestion: Suggestion, event: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		const mention = this.mention;
		this.finish();
		if (!context || !mention) return;
		const intent = selectionIntent(suggestion, event);
		if (intent === "openDatesModal") this.openDatesModal(mention, context);
		else if (!isMoreRow(suggestion)) this.insertLinks(suggestion, mention, context, intent === "insertWithAlias");
	}

	close(): void {
		const context = this.context;
		const mention = this.mention;
		if (context && mention && this.rows.length > 0 && this.isStillTyped(context, mention)) this.dismissal = { position: positionKey(context.file, context.start, mention) };
		this.finish();
	}

	private finish(): void {
		this.rows = [];
		this.mention = undefined;
		super.close();
	}

	private rowContext(mention: Mention): RowContext {
		return obsidianRowContext(this.settings(), mention.targets);
	}

	private isStillTyped({ editor, file, start }: EditorSuggestContext, mention: Mention): boolean {
		const cursor = editor.getCursor();
		if (cursor.line !== start.line || this.app.workspace.getActiveFile() !== file) return false;
		const active = activeMentionAt(editor.getLine(cursor.line).slice(0, cursor.ch), this.settings().mentions);
		return active?.match.start === start.ch && active.mention.id === mention.id;
	}

	private insertLinks(row: DateRow, mention: Mention, { editor, file, start, end }: EditorSuggestContext, withAlias: boolean): void {
		const destination = destinationInActiveEditor(editor);
		if (destination.kind === "frontmatterWithoutProperty") return noticeNoProperty();
		const links = obsidianLinks(this.app, file.path, mention)(destination.kind, row.notes, row.text, withAlias);
		if (destination.kind === "property") return addDatesToProperty(this.app, editor, file, destination.name, links, { start, end });
		insertLinks(editor, links, mention.separator, { start, end });
	}

	private openDatesModal(mention: Mention, { editor, file, start, end, query }: EditorSuggestContext): void {
		const destination = destinationInActiveEditor(editor);
		if (destination.kind === "frontmatterWithoutProperty") return noticeNoProperty();
		openInsertDatesModal(this.settings, mention, { app: this.app, editor, file, destination, range: { start, end } }, query);
	}

	private showInstructions(): void {
		if (Platform.isMobile) return;
		this.setInstructions([
			{ command: "↵", purpose: t("instructionInsertLink") },
			{ command: "⌥↵", purpose: t("instructionWithAlias") },
			{ command: "⇧↵", purpose: t("instructionMore") },
			{ command: "esc", purpose: t("instructionDismiss") },
		]);
	}
}

function positionKey(file: TFile, { line, ch }: EditorPosition, mention: Mention): string {
	return `${file.path}:${line}:${ch}:${mention.id}`;
}

function linesOf(editor: Editor): string[] {
	return Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
}
