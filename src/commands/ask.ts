import { MarkdownView, Notice } from "obsidian";
import type { App, Editor, TFile } from "obsidian";
import { t } from "../i18n/index.ts";
import { DateNotePickerModal } from "../dateNotes/phraseModal.ts";
import { addDatesToProperty, destinationInActiveEditor, noticeNoProperty, obsidianLinkBuilders } from "../insertion/obsidianHost.ts";
import type { LinkBuilders } from "../insertion/linksToWrite.ts";
import { DatesModal } from "../sequence/modal.ts";
import { insertLinks } from "../sequence/preview.ts";
import type { DateCompassSettings } from "../settings.ts";
import { commandWarning } from "./settings.ts";
import type { DateCommand } from "./settings.ts";
import { datesQuestionFor, pickerTextFor } from "./pickerText.ts";
import { propertyWidgetOf } from "./propertyType.ts";
import { propertyKind, writeToFrontmatter } from "./value.ts";
import type { PropertyKind } from "./value.ts";
import { aliasChosen, aliasedPropertyLink, cursorTarget, offersAlias, propertyTarget, textsToWrite } from "./write.ts";
import type { CommandAnswer, CommandWrite, WriteTarget } from "./write.ts";

interface Question {
	command: DateCommand;
	target: WriteTarget;
	kind: PropertyKind;
	links: LinkBuilders;
}

function writeOf(question: Question, answer: CommandAnswer): CommandWrite {
	return { ...question, ...answer };
}

function ask(app: App, settings: () => DateCompassSettings, question: Question): Promise<CommandAnswer | undefined> {
	const { command, target, kind } = question;
	const aliasOffered = offersAlias(command, target, kind);
	return new Promise((resolve) => {
		let settled = false;
		const answer = (given: CommandAnswer | undefined) => {
			if (settled) return;
			settled = true;
			resolve(given);
		};
		const dismissed = () => answer(undefined);
		if (command.asks === "dates") {
			new DatesModal(
				app,
				settings,
				{
					...datesQuestionFor(command, target, kind),
					initialText: "",
					targets: command.targets,
					links: aliasOffered ? (notes, phrase, withAlias) => textsToWrite(writeOf(question, { notes, phrase, withAlias })) : undefined,
				},
				(preview, withAlias, phrase) => {
					if (preview.kind !== "dates") return false;
					answer({ notes: preview.notes, phrase, withAlias });
					return true;
				},
				dismissed,
			).open();
			return;
		}
		new DateNotePickerModal(app, settings, {
			...pickerTextFor(command, target, kind),
			targets: command.targets,
			aliasWithAltEnter: aliasOffered,
			choose: (row, event) => answer({ notes: row.notes, phrase: row.text, withAlias: aliasChosen(aliasOffered, event) }),
			dismissed,
		}).openWithQuery("");
	});
}

function noticeFailure(error: unknown): void {
	new Notice(t("commandFailed", { error: error instanceof Error ? error.message : String(error) }));
}

export function canRunPropertyCommand(app: App): boolean {
	return app.workspace.getActiveViewOfType(MarkdownView)?.file != null;
}

export async function runPropertyCommand(app: App, settings: () => DateCompassSettings, command: DateCommand): Promise<void> {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!view || !file) return;
	if (commandWarning(command)) return;
	const target = propertyTarget(command);
	try {
		const kind = propertyKind(propertyWidgetOf(app, target.property));
		const question: Question = { command, target, kind, links: obsidianLinkBuilders(app, file.path, command.linkPath) };
		const answer = await ask(app, settings, question);
		if (!answer || answer.notes.length === 0) return;
		await view.save();
		await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			writeToFrontmatter(frontmatter, target.property, {
				notes: answer.notes,
				link: command.link,
				kind,
				mode: target.mode,
				linkTo: aliasedPropertyLink(writeOf(question, answer)),
			});
		});
	} catch (error) {
		noticeFailure(error);
	}
}

export async function runCursorCommand(app: App, settings: () => DateCompassSettings, command: DateCommand, editor: Editor, file: TFile | undefined): Promise<void> {
	const target = cursorTarget(destinationInActiveEditor(editor), file !== undefined);
	if (target.kind === "noProperty") return noticeNoProperty();
	try {
		const kind = target.kind === "propertyUnderCursor" ? propertyKind(propertyWidgetOf(app, target.property)) : "other";
		const question: Question = { command, target, kind, links: obsidianLinkBuilders(app, file?.path ?? "", command.linkPath) };
		const answer = await ask(app, settings, question);
		if (!answer || answer.notes.length === 0) return;
		const texts = textsToWrite(writeOf(question, answer));
		if (target.kind === "propertyUnderCursor" && file) addDatesToProperty(app, editor, file, target.property, texts);
		else insertLinks(editor, texts, command.separator);
	} catch (error) {
		noticeFailure(error);
	}
}
