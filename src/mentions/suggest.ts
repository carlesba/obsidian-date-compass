import { EditorSuggest, Platform } from "obsidian";
import type { App, Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import type { DateCompassSettings } from "../settings.ts";
import { localeParseOptions } from "../obsidianParseOptions.ts";
import { markdownLinkTo } from "./obsidianHost.ts";
import { aliasOf, buildRows, joinLinks, mentionAllows, rowLabel } from "./rows.ts";
import type { DateRow } from "./rows.ts";
import { isDeadEnd, isInCode, mentionAt } from "./trigger.ts";

export class DateMentionSuggest extends EditorSuggest<DateRow> {
	private readonly settings: () => DateCompassSettings;
	private dismissedAt: string | undefined;
	private rows: DateRow[] = [];

	constructor(app: App, settings: () => DateCompassSettings) {
		super(app);
		this.settings = settings;
		this.showInstructions();
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		const { mentions } = this.settings();
		if (!mentions.enabled || !file) return null;
		const lineBeforeCaret = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = mentionAt(lineBeforeCaret, mentions.trigger);
		if (!match) {
			this.dismissedAt = undefined;
			return null;
		}
		const start = { line: cursor.line, ch: match.start };
		const position = positionKey(file, start);
		if (position === this.dismissedAt) return null;
		if (isInCode(linesAbove(editor, cursor.line), lineBeforeCaret)) return null;
		const rows = this.rowsFor(match.query);
		if (isDeadEnd(match.query, (text) => (text === match.query ? rows : this.rowsFor(text)).length > 0)) {
			this.dismissedAt = position;
			return null;
		}
		this.rows = rows;
		return { start, end: cursor, query: match.query };
	}

	getSuggestions(): DateRow[] {
		return this.rows;
	}

	renderSuggestion(row: DateRow, el: HTMLElement): void {
		el.setText(rowLabel(row, obsidianMoment()));
	}

	selectSuggestion(row: DateRow): void {
		const context = this.context;
		this.finish();
		if (context) this.insertLinks([row], context);
	}

	close(): void {
		const context = this.context;
		if (context && this.isStillTyped(context)) this.dismissedAt = positionKey(context.file, context.start);
		this.finish();
	}

	private finish(): void {
		this.rows = [];
		super.close();
	}

	private rowsFor(query: string): DateRow[] {
		const settings = this.settings();
		return buildRows(query, {
			now: obsidianMoment(),
			moment: obsidianMoment,
			options: localeParseOptions(settings),
			periods: settings.dateNotes.periods,
			allows: mentionAllows(settings.mentions),
		});
	}

	private isStillTyped({ editor, file, start }: EditorSuggestContext): boolean {
		const cursor = editor.getCursor();
		if (cursor.line !== start.line || this.app.workspace.getActiveFile() !== file) return false;
		const match = mentionAt(editor.getLine(cursor.line).slice(0, cursor.ch), this.settings().mentions.trigger);
		return match?.start === start.ch;
	}

	private insertLinks(rows: readonly DateRow[], { editor, file, start, end }: EditorSuggestContext): void {
		const { mentions } = this.settings();
		const links = rows.map((row) => markdownLinkTo(this.app, row.path, file.path, aliasOf(row, mentions)));
		editor.replaceRange(joinLinks(links, mentions.separator), start, end);
	}

	private showInstructions(): void {
		if (Platform.isMobile) return;
		this.setInstructions([
			{ command: "↵", purpose: t("instructionInsertLink") },
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
