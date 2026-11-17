import { EditorSuggest, Platform } from "obsidian";
import type { App, Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { obsidianRowContext } from "../obsidianParseOptions.ts";
import { insertionLinks, usesAlias } from "../insertion/render.ts";
import { insertLinks } from "../sequence/preview.ts";
import { openInsertDatesModal } from "../sequence/modal.ts";
import { markdownLinkTo } from "./obsidianHost.ts";
import { buildRows, mayStillMatch, mentionAllows, rowLabel } from "./rows.ts";
import type { DateRow, RowContext } from "./rows.ts";
import { isMoreRow, selectionIntent, withMoreRow } from "./selection.ts";
import type { Suggestion } from "./selection.ts";
import { isDeadEnd, isDismissed, isInCode, mentionAt } from "./trigger.ts";
import type { Dismissal } from "./trigger.ts";

export class DateMentionSuggest extends EditorSuggest<Suggestion> {
	private readonly settings: () => DateCompassSettings;
	private dismissal: Dismissal | undefined;
	private rows: DateRow[] = [];

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
		const { mentions } = this.settings();
		if (!mentions.enabled || !file) return null;
		const lineBeforeCaret = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = mentionAt(lineBeforeCaret, mentions.trigger);
		this.rows = [];
		if (!match) {
			this.dismissal = undefined;
			return null;
		}
		const start = { line: cursor.line, ch: match.start };
		const position = positionKey(file, start);
		if (isDismissed(this.dismissal, position, match.query)) return null;
		if (isInCode(linesAbove(editor, cursor.line), lineBeforeCaret)) return null;
		const rows = this.rowsFor(match.query);
		if (rows.length === 0 && isDeadEnd(match.query, (text) => mayStillMatch(text, this.rowContext()))) {
			this.dismissal = { position, deadEndQuery: match.query };
			return null;
		}
		this.rows = rows;
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
		this.finish();
		if (!context) return;
		const intent = selectionIntent(suggestion, event);
		if (intent === "openDatesModal") this.openDatesModal(context);
		else if (!isMoreRow(suggestion)) this.insertLinks(suggestion, context, intent === "insertFlippingAlias");
	}

	close(): void {
		const context = this.context;
		if (context && this.rows.length > 0 && this.isStillTyped(context)) this.dismissal = { position: positionKey(context.file, context.start) };
		this.finish();
	}

	private finish(): void {
		this.rows = [];
		super.close();
	}

	private rowsFor(query: string): DateRow[] {
		return buildRows(query, this.rowContext());
	}

	private rowContext(): RowContext {
		const settings = this.settings();
		return obsidianRowContext(settings, mentionAllows(settings.mentions));
	}

	private isStillTyped({ editor, file, start }: EditorSuggestContext): boolean {
		const cursor = editor.getCursor();
		if (cursor.line !== start.line || this.app.workspace.getActiveFile() !== file) return false;
		const match = mentionAt(editor.getLine(cursor.line).slice(0, cursor.ch), this.settings().mentions.trigger);
		return match?.start === start.ch;
	}

	private insertLinks(row: DateRow, { editor, file, start, end }: EditorSuggestContext, flippingAlias: boolean): void {
		const { insertion } = this.settings();
		const links = insertionLinks(row.notes, row.text, insertion, usesAlias(insertion, flippingAlias), (note, alias) => markdownLinkTo(this.app, note.path, file.path, alias));
		insertLinks(editor, links, insertion.separator, { start, end });
	}

	private openDatesModal({ editor, file, start, end, query }: EditorSuggestContext): void {
		openInsertDatesModal(this.settings, { app: this.app, editor, file, destination: { kind: "body" }, range: { start, end } }, query);
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

function positionKey(file: TFile, { line, ch }: EditorPosition): string {
	return `${file.path}:${line}:${ch}`;
}

function linesAbove(editor: Editor, line: number): string[] {
	const lines: string[] = [];
	for (let index = 0; index < line; index++) lines.push(editor.getLine(index));
	return lines;
}
