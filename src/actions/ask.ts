import { MarkdownView, Notice } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n/index.ts";
import { DateNotePickerModal } from "../dateNotes/phraseModal.ts";
import { propertyLinkTo } from "../mentions/obsidianHost.ts";
import type { NoteRef } from "../mentions/rows.ts";
import { DatesModal } from "../sequence/modal.ts";
import type { DateCompassSettings } from "../settings.ts";
import { actionWarning, questionOf } from "./settings.ts";
import type { DateAction } from "./settings.ts";
import { pickerTextOf } from "./pickerText.ts";
import { propertyWidgetOf } from "./propertyType.ts";
import { effectiveMode, propertyKind, writeToFrontmatter } from "./value.ts";
import type { PropertyKind } from "./value.ts";

function askForNotes(app: App, settings: () => DateCompassSettings, action: DateAction, kind: PropertyKind): Promise<NoteRef[] | undefined> {
	const mode = effectiveMode(action.mode, kind);
	return new Promise((resolve) => {
		let settled = false;
		const answer = (notes: NoteRef[] | undefined) => {
			if (settled) return;
			settled = true;
			resolve(notes);
		};
		const dismissed = () => answer(undefined);
		if (action.asks === "dates") {
			new DatesModal(
				app,
				settings,
				{ title: questionOf(action), initialText: "", propertyName: action.property.trim(), replacesProperty: mode === "replace" },
				(preview) => {
					if (preview.kind !== "dates") return false;
					answer(preview.notes);
					return true;
				},
				dismissed,
			).open();
			return;
		}
		new DateNotePickerModal(app, settings, {
			...pickerTextOf(action, mode),
			choose: (row) => answer(row.notes),
			dismissed,
		}).openWithQuery("");
	});
}

export function canRunAction(app: App): boolean {
	return app.workspace.getActiveViewOfType(MarkdownView)?.file != null;
}

export async function runActionInActiveNote(app: App, settings: () => DateCompassSettings, action: DateAction): Promise<void> {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!view || !file) return;
	if (actionWarning(action)) return;
	const property = action.property.trim();
	try {
		const kind = propertyKind(propertyWidgetOf(app, property));
		const notes = await askForNotes(app, settings, action, kind);
		if (!notes || notes.length === 0) return;
		await view.save();
		await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			writeToFrontmatter(frontmatter, property, {
				notes,
				link: action.link,
				kind,
				mode: action.mode,
				linkTo: (note) => propertyLinkTo(app, note, file.path),
			});
		});
	} catch (error) {
		new Notice(t("actionFailed", { error: error instanceof Error ? error.message : String(error) }));
	}
}
