import type { SettingDefinitionItem, SettingDefinitionPage } from "obsidian";

export type IdentifiedPage = SettingDefinitionPage & { id: string };

function pageIdOf(page: SettingDefinitionPage): string {
	const { id } = page as SettingDefinitionPage & { id?: string };
	return id ?? page.name;
}

export function pagePath(items: readonly SettingDefinitionItem[], pageId: string): string[] | undefined {
	for (const item of items) {
		if (!("type" in item)) continue;
		if (item.type === "page") {
			if (pageIdOf(item) === pageId) return [pageId];
			const inner = item.items ? pagePath(item.items, pageId) : undefined;
			if (inner) return [pageIdOf(item), ...inner];
			continue;
		}
		const inGroup = item.items ? pagePath(item.items, pageId) : undefined;
		if (inGroup) return inGroup;
	}
	return undefined;
}

export function pageAt(items: readonly SettingDefinitionItem[], path: readonly string[]): SettingDefinitionPage | undefined {
	const [first, ...rest] = path;
	if (first === undefined) return undefined;
	for (const item of items) {
		if (!("type" in item)) continue;
		if (item.type === "page") {
			if (pageIdOf(item) !== first) continue;
			return rest.length === 0 ? item : item.items && pageAt(item.items, rest);
		}
		const inGroup = item.items && pageAt(item.items, path);
		if (inGroup) return inGroup;
	}
	return undefined;
}
