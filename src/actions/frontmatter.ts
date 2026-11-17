import { dateOf } from "../dateNotes/paths.ts";
import type { MomentFactory } from "../dateNotes/paths.ts";
import { PERIODS, mapPeriods } from "../dateNotes/periods.ts";
import type { PeriodSettingsByPeriod } from "../dateNotes/periods.ts";
import type { PropertyMode } from "./settings.ts";

export type SortKeyOf = (item: unknown) => string | undefined;

export interface PropertyWrite {
	property: string;
	values: string[];
	mode: PropertyMode;
}

export function mergedProperty(existing: unknown, values: readonly string[], mode: PropertyMode, sortKeyOf: SortKeyOf): unknown {
	if (mode === "replace") return values.length === 1 ? values[0] : [...values];
	const merged = [...existingItems(existing), ...values];
	if (mode === "append") return merged;
	return dedupedAndSorted(merged, sortKeyOf);
}

export function applyPropertyWrites(frontmatter: Record<string, unknown>, writes: readonly PropertyWrite[], sortKeyOf: SortKeyOf): void {
	for (const write of writes) frontmatter[write.property] = mergedProperty(frontmatter[write.property], write.values, write.mode, sortKeyOf);
}

function existingItems(existing: unknown): unknown[] {
	if (existing === undefined || existing === null || existing === "") return [];
	return Array.isArray(existing) ? existing : [existing];
}

function dedupedAndSorted(items: readonly unknown[], sortKeyOf: SortKeyOf): unknown[] {
	const seen = new Set<string>();
	const unique = items.filter((item) => {
		const textOfItem = itemText(item);
		if (seen.has(textOfItem)) return false;
		seen.add(textOfItem);
		return true;
	});
	const keyed = unique.map((item) => ({ item, key: sortKeyOf(item), text: itemText(item) }));
	keyed.sort((a, b) => {
		if (a.key !== undefined && b.key !== undefined) return a.key.localeCompare(b.key);
		if (a.key !== undefined) return -1;
		if (b.key !== undefined) return 1;
		return a.text.localeCompare(b.text);
	});
	return keyed.map(({ item }) => item);
}

function itemText(item: unknown): string {
	return typeof item === "string" ? item : JSON.stringify(item);
}

const WIKILINK = /^\[\[([^\]|#]+)/;

const MARKDOWN_LINK = /^\[[^\]]*\]\(<?([^)>]+)>?\)/;

export function linkTarget(text: string): string {
	const trimmed = text.trim();
	const wikilink = WIKILINK.exec(trimmed);
	if (wikilink) return wikilink[1].trim();
	const markdown = MARKDOWN_LINK.exec(trimmed);
	if (markdown) return safeDecode(markdown[1].trim());
	return trimmed;
}

function safeDecode(text: string): string {
	try {
		return decodeURI(text);
	} catch {
		return text;
	}
}

export function dateSortKey(periods: PeriodSettingsByPeriod, moment: MomentFactory): SortKeyOf {
	const withoutFolders = mapPeriods((period) => ({ ...periods[period], folder: "" }));
	return (item) => {
		if (typeof item !== "string") return undefined;
		const target = linkTarget(item).replace(/\.md$/, "");
		if (target === "") return undefined;
		const basename = target.split("/").pop() ?? target;
		const note = dateOf(`${target}.md`, periods, moment) ?? dateOf(`${target}.md`, withoutFolders, moment) ?? dateOf(`${basename}.md`, withoutFolders, moment);
		if (!note) return undefined;
		return `${note.date.format("YYYY-MM-DD")} ${PERIODS.indexOf(note.period)}`;
	};
}
