import { MarkdownView, Notice } from "obsidian";
import type { App, Editor, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { markdownLinkTo, propertyLinkTo } from "../mentions/obsidianHost.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { DateCompassSettings } from "../settings.ts";
import { insertionLinks } from "./render.ts";
import { propertyWithLinks } from "./property.ts";
import { chooseDestination } from "./destination.ts";
import type { DatesDestination } from "./destination.ts";
import type { InsertionRange } from "../sequence/preview.ts";

export function focusedPropertyName(doc: Document = activeDocument): string | undefined {
	try {
		const property = doc.activeElement?.closest(".metadata-property");
		const name = property?.getAttribute("data-property-key");
		return typeof name === "string" && name !== "" ? name : undefined;
	} catch {
		return undefined;
	}
}

export function obsidianLinks(app: App, sourcePath: string, settings: DateCompassSettings) {
	return (notes: readonly NoteRef[], phrase: string, withAlias: boolean): string[] =>
		insertionLinks(notes, phrase, settings.insertion, withAlias, (note, alias) => markdownLinkTo(app, note.path, sourcePath, alias));
}

export function destinationInActiveEditor(editor: Editor): DatesDestination {
	const lines = Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
	return chooseDestination({ lines, cursorLine: editor.getCursor("from").line, focusedProperty: focusedPropertyName() });
}

export function addDatesToProperty(app: App, editor: Editor, file: TFile, name: string, notes: readonly NoteRef[], range?: InsertionRange): void {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (range && view?.file?.path !== file.path) {
		noticePropertyNotWritten();
		return;
	}
	if (range) editor.replaceRange("", range.start, range.end);
	const write = async () => {
		if (range) await view?.save();
		const links = notes.map((note) => propertyLinkTo(app, note, file.path));
		await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			const updated = propertyWithLinks(frontmatter[name], links);
			if (updated) frontmatter[name] = updated;
		});
	};
	write().catch(noticePropertyNotWritten);
}

export function noticePropertyNotWritten(): void {
	new Notice(t("propertyNotWritten"));
}

export function noticeNoProperty(): void {
	new Notice(t("noPropertyAtCursor"));
}
