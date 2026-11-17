import { Notice } from "obsidian";
import type { App, Editor, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { dateSortKey, applyPropertyWrites } from "../actions/frontmatter.ts";
import { obsidianMoment } from "../dateNotes/obsidianHost.ts";
import { markdownLinkTo, propertyLinkTo } from "../mentions/obsidianHost.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { DateCompassSettings } from "../settings.ts";
import { insertionLinks } from "./render.ts";
import { chooseDestination } from "./destination.ts";
import type { DatesDestination } from "./destination.ts";

export function focusedPropertyName(doc: Document = document): string | undefined {
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

export async function addDatesToProperty(app: App, file: TFile, name: string, notes: readonly NoteRef[], periods: PeriodSettingsByPeriod): Promise<void> {
	const values = notes.map((note) => propertyLinkTo(app, note, file.path));
	const sortKeyOf = dateSortKey(periods, obsidianMoment);
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => applyPropertyWrites(frontmatter, [{ property: name, values, mode: "dedupeSort" }], sortKeyOf));
}

export function noticePropertyNotWritten(): void {
	new Notice(t("propertyNotWritten"));
}

export function noticeNoProperty(): void {
	new Notice(t("noPropertyAtCursor"));
}
