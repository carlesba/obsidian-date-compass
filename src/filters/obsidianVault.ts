import { getAllTags, getLinkpath, moment } from "obsidian";
import type { App } from "obsidian";
import { propertyType } from "./conditions.ts";
import type { PropertyType } from "./conditions.ts";
import type { FilterVault } from "./vault.ts";

interface PropertyRegistry {
	metadataTypeManager?: { getAllProperties(): Record<string, { widget?: unknown } | undefined> };
}

export interface PropertySuggestion {
	name: string;
	type: PropertyType;
}

export function createFilterVault(app: App): FilterVault {
	return {
		notes: () => app.vault.getMarkdownFiles().map((file) => ({ path: file.path, basename: file.basename, ctime: file.stat.ctime })),
		frontmatter: (path) => {
			const file = app.vault.getFileByPath(path);
			return file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
		},
		tags: (path) => {
			const file = app.vault.getFileByPath(path);
			const cache = file ? app.metadataCache.getFileCache(file) : null;
			return cache ? (getAllTags(cache) ?? []) : [];
		},
		linksFrom: (path) => Object.keys(app.metadataCache.resolvedLinks[path] ?? {}),
		linksTo: (path) =>
			Object.entries(app.metadataCache.resolvedLinks)
				.filter(([, targets]) => path in targets)
				.map(([source]) => source),
		embeds: (path) => {
			const file = app.vault.getFileByPath(path);
			const embeds = file ? (app.metadataCache.getFileCache(file)?.embeds ?? []) : [];
			return embeds.flatMap((embed) => app.metadataCache.getFirstLinkpathDest(getLinkpath(embed.link), path)?.path ?? []);
		},
		size: (path) => app.vault.getFileByPath(path)?.stat.size ?? 0,
		mtime: (path) => app.vault.getFileByPath(path)?.stat.mtime ?? 0,
		moment,
	};
}

export function propertyTypesOf(app: App): Record<string, string> {
	const widgets: Record<string, string> = {};
	try {
		const properties = (app as App & PropertyRegistry).metadataTypeManager?.getAllProperties() ?? {};
		for (const [name, property] of Object.entries(properties)) {
			if (typeof property?.widget === "string") widgets[name.toLowerCase()] = property.widget;
		}
	} catch {
		return {};
	}
	return widgets;
}

export function propertySuggestions(vault: Pick<FilterVault, "notes" | "frontmatter">, types: Record<string, string>): PropertySuggestion[] {
	const names = new Map<string, string>();
	for (const note of vault.notes()) {
		for (const name of Object.keys(vault.frontmatter(note.path) ?? {})) {
			if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
		}
	}
	for (const name of Object.keys(types)) if (!names.has(name)) names.set(name, name);
	return Array.from(names.values())
		.sort((a, b) => a.localeCompare(b))
		.map((name) => ({ name, type: propertyType(types, name) }));
}
