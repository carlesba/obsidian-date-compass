import type { App, TFile } from "obsidian";
import type { NoteRef } from "./rows.ts";
import type { EnabledPlugin } from "./conflicts.ts";
import { PLUGINS_WITH_TRIGGERS } from "./conflicts.ts";

interface PluginRegistry {
	plugins?: {
		enabledPlugins?: Set<string>;
		getPlugin?(id: string): { settings?: unknown; manifest?: { name?: string } } | null | undefined;
	};
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

export function markdownLinkTo(app: App, path: string, sourcePath: string, alias: string | undefined): string {
	const target = app.vault.getFileByPath(path) ?? unsavedFile(path);
	return app.fileManager.generateMarkdownLink(target, sourcePath, undefined, alias);
}

export function propertyLinkTo(app: App, note: NoteRef, sourcePath: string): string {
	return `[[${app.metadataCache.fileToLinktext(app.vault.getFileByPath(note.path) ?? unsavedFile(note.path), sourcePath, true)}]]`;
}

export function unsavedFile(path: string): TFile {
	const name = path.split("/").pop() ?? path;
	const extension = name.includes(".") ? (name.split(".").pop() ?? "") : "";
	const basename = extension === "" ? name : name.slice(0, -extension.length - 1);
	return { path, name, basename, extension } as unknown as TFile;
}
