import { fileRule } from "./filters.ts";
import type { FilterRule } from "./filters.ts";
import type { Frontmatter } from "./vault.ts";

export const LEGACY_FILTER_KINDS = ["pathStartsWith", "nameStartsWith", "tag", "property"] as const;
export type LegacyFilterKind = (typeof LEGACY_FILTER_KINDS)[number];

export interface LegacyFilter {
	kind: LegacyFilterKind;
	value: string;
}

export interface LegacyNote {
	path: string;
	tags: readonly string[];
	frontmatter: Frontmatter | undefined;
}

export interface MigratedFilters {
	rules: FilterRule[];
	kept: LegacyFilter[];
}

export function readLegacyFilters(stored: unknown): LegacyFilter[] | undefined {
	if (!Array.isArray(stored)) return undefined;
	const filters: LegacyFilter[] = [];
	for (const entry of stored) {
		if (!isRecord(entry) || typeof entry.value !== "string") return undefined;
		const kind = LEGACY_FILTER_KINDS.find((known) => known === entry.kind);
		if (!kind) return undefined;
		filters.push({ kind, value: entry.value });
	}
	return filters;
}

export function migrateLegacyFilters(filters: readonly LegacyFilter[]): MigratedFilters {
	const migrated: MigratedFilters = { rules: [], kept: [] };
	for (const filter of filters) {
		if (matchesEveryNote(filter)) continue;
		const rule = equivalentRule(filter);
		if (rule) migrated.rules.push(rule);
		else migrated.kept.push({ kind: filter.kind, value: filter.value });
	}
	return migrated;
}

function matchesEveryNote({ kind, value }: LegacyFilter): boolean {
	const wanted = value.trim();
	return wanted === "" || (kind === "pathStartsWith" && withoutLeadingSlashes(wanted) === "");
}

function equivalentRule({ kind, value }: LegacyFilter): FilterRule | undefined {
	const wanted = value.trim();
	switch (kind) {
		case "tag":
			return fileRule("file", { operator: "has tag", value: wanted });
		case "pathStartsWith": {
			const prefix = withoutLeadingSlashes(wanted);
			return readsTheSameInAnyCase(prefix) ? fileRule("path", { operator: "starts with", value: prefix }) : undefined;
		}
		case "nameStartsWith":
			return readsTheSameInAnyCase(wanted) ? fileRule("fullname", { operator: "starts with", value: wanted }) : undefined;
		case "property":
			return undefined;
	}
}

function readsTheSameInAnyCase(text: string): boolean {
	return text.toLowerCase() === text && text.toUpperCase() === text;
}

export function matchesLegacyFilters(note: LegacyNote, filters: readonly LegacyFilter[]): boolean {
	return filters.every((filter) => matchesLegacyFilter(note, filter));
}

function matchesLegacyFilter(note: LegacyNote, { kind, value }: LegacyFilter): boolean {
	const wanted = value.trim();
	if (wanted === "") return true;
	switch (kind) {
		case "pathStartsWith":
			return note.path.toLowerCase().startsWith(withoutLeadingSlashes(wanted).toLowerCase());
		case "nameStartsWith":
			return fileNameOf(note.path).toLowerCase().startsWith(wanted.toLowerCase());
		case "tag":
			return hasTag(note.tags, wanted);
		case "property":
			return hasProperty(note.frontmatter, wanted);
	}
}

function withoutLeadingSlashes(path: string): string {
	return path.replace(/^\/+/, "");
}

function fileNameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

function hasTag(tags: readonly string[], wanted: string): boolean {
	const tag = withoutHash(wanted).toLowerCase();
	return tags.some((candidate) => {
		const normalized = withoutHash(candidate).toLowerCase();
		return normalized === tag || normalized.startsWith(`${tag}/`);
	});
}

function withoutHash(tag: string): string {
	return tag.trim().replace(/^#/, "");
}

function hasProperty(frontmatter: Frontmatter | undefined, wanted: string): boolean {
	if (!frontmatter) return false;
	const separator = wanted.indexOf(":");
	const key = (separator < 0 ? wanted : wanted.slice(0, separator)).trim().toLowerCase();
	const entry = Object.entries(frontmatter).find(([candidate]) => candidate.toLowerCase() === key);
	if (!entry) return false;
	const [, stored] = entry;
	if (separator < 0) return !isEmptyValue(stored);
	const expected = wanted.slice(separator + 1).trim().toLowerCase();
	return valuesOf(stored).some((candidate) => candidate.toLowerCase() === expected);
}

function isEmptyValue(value: unknown): boolean {
	return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function valuesOf(value: unknown): string[] {
	const values = Array.isArray(value) ? value : [value];
	return values.filter((candidate) => ["string", "number", "boolean"].includes(typeof candidate)).map((candidate) => String(candidate).trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
