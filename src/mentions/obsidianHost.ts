import { TFile } from "obsidian";
import type { App, Vault } from "obsidian";
import { fileNameParts } from "../dateNotes/paths.ts";
import type { NoteRef } from "./rows.ts";
import type { EnabledPlugin } from "./conflicts.ts";
import { PLUGINS_WITH_TRIGGERS } from "./conflicts.ts";
import { slashCommandsEnabledIn } from "./clashes.ts";
import { linkTarget, linktextOf, markdownLink, parentFolder, wikilink } from "../insertion/linkPath.ts";
import type { LinkPath, LinkTarget, NoteLinkFacts } from "../insertion/linkPath.ts";

interface PluginRegistry {
	plugins?: {
		enabledPlugins?: Set<string>;
		getPlugin?(id: string): { settings?: unknown; manifest?: { name?: string } } | null | undefined;
	};
}

interface VaultConfig {
	getConfig?(key: string): unknown;
}

export function enabledPluginsWithTriggers(app: App): EnabledPlugin[] {
	try {
		const registry = (app as App & PluginRegistry).plugins;
		return PLUGINS_WITH_TRIGGERS.filter((id) => registry?.enabledPlugins?.has(id)).flatMap((id) => {
			const plugin = registry?.getPlugin?.(id);
			return plugin ? [{ id, name: plugin.manifest?.name ?? id, settings: plugin.settings }] : [];
		});
	} catch {
		return [];
	}
}

export function slashCommandsEnabled(app: App): boolean | undefined {
	try {
		return slashCommandsEnabledIn((app as App & { internalPlugins?: unknown }).internalPlugins);
	} catch {
		return undefined;
	}
}

export function markdownLinkTo(app: App, note: NoteRef, sourcePath: string, alias: string | undefined, linkPath: LinkPath): string {
	const file = app.vault.getFileByPath(note.path);
	const generated = app.fileManager.generateMarkdownLink(file ?? unsavedFile(note.path), sourcePath, undefined, alias);
	const target = noteLinkTarget(app, note, file, sourcePath, linkPath);
	if (target === "obsidian") return generated;
	const linktext = linktextOf(target, note);
	return generated.startsWith("[[") ? wikilink(linktext, alias) : markdownLink(linktext, alias ?? note.name);
}

export function propertyLinkTo(app: App, note: NoteRef, sourcePath: string, alias: string | undefined, linkPath: LinkPath): string {
	const file = app.vault.getFileByPath(note.path);
	const target = noteLinkTarget(app, note, file, sourcePath, linkPath);
	return wikilink(target === "obsidian" ? app.metadataCache.fileToLinktext(file ?? unsavedFile(note.path), sourcePath, true) : linktextOf(target, note), alias);
}

function noteLinkTarget(app: App, note: NoteRef, file: TFile | null, sourcePath: string, linkPath: LinkPath): LinkTarget {
	return linkTarget(linkPath, (): NoteLinkFacts => {
		const newNoteParent = app.fileManager.getNewFileParent(sourcePath, `${note.name}.md`);
		return {
			exists: file !== null,
			shortestLinks: linkFormat(app.vault) === "shortest",
			nameTaken: app.metadataCache.getFirstLinkpathDest(note.name, sourcePath) !== null,
			createdInItsFolder: (newNoteParent.isRoot() ? "" : newNoteParent.path) === parentFolder(note.path),
		};
	});
}

function linkFormat(vault: Vault): unknown {
	try {
		return (vault as Vault & VaultConfig).getConfig?.("newLinkFormat");
	} catch {
		return undefined;
	}
}

function unsavedFile(path: string): TFile {
	const file: unknown = Object.create(TFile.prototype);
	if (!(file instanceof TFile)) throw new Error(`Cannot build a link to ${path}`);
	return Object.assign(file, fileNameParts(path));
}
