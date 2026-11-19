import { isRecord } from "../dateNotes/periods.ts";
import { freeId, uniqueId } from "../settings/entryList.ts";
import { emptyFilter, noteMatcher, readFilter } from "../filters/filters.ts";
import type { FilterContext, FilterGroup } from "../filters/filters.ts";
import { matchesLegacyFilters, migrateLegacyFilters, readLegacyFilters } from "../filters/legacy.ts";
import type { LegacyFilter } from "../filters/legacy.ts";
import type { VaultNote } from "../filters/vault.ts";

export const DOT_SOURCES = ["words", "openTasks", "links"] as const;
export type DotSource = (typeof DOT_SOURCES)[number];

export const DOT_COUNTS = ["presence", "perAmount"] as const;
export type DotCount = (typeof DOT_COUNTS)[number];

export const DOT_SHAPES = ["filled", "hollow"] as const;
export type DotShape = (typeof DOT_SHAPES)[number];

export const DOT_COLORS = ["default", "accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;
export type DotColor = (typeof DOT_COLORS)[number];

export const DOT_CELLS = ["day", "week", "month", "quarter", "year"] as const;
export type DotCell = (typeof DOT_CELLS)[number];

export const DOT_TIMES = ["past", "current", "future"] as const;
export type DotTime = (typeof DOT_TIMES)[number];

export interface DotPlace {
	cell: DotCell;
	time: DotTime;
}

export const DOT_POSITIONS = ["below", "above", "topLeft", "topRight"] as const;
export type DotPosition = (typeof DOT_POSITIONS)[number];

export type LinkPlace = { kind: "body" } | { kind: "anyProperty" } | { kind: "property"; name: string };

export interface LinkLocation {
	property?: string;
}

export const DECORATOR_FIELDS = ["name", "source", "count", "amountPerDot", "maxDots", "shape", "color", "position", "showWithoutNote", "cells", "times", "linkPlaces"] as const;
export type DecoratorField = (typeof DECORATOR_FIELDS)[number];

export interface DotDecorator {
	id: string;
	name: string;
	source: DotSource;
	count: DotCount;
	amountPerDot: number;
	maxDots: number;
	shape: DotShape;
	color: DotColor;
	position: DotPosition;
	showWithoutNote: boolean;
	cells: DotCell[];
	times: DotTime[];
	linkPlaces: LinkPlace[];
	filter: FilterGroup;
	legacyFilters: LegacyFilter[];
	unreadableFilter?: unknown;
}

export type LinkingNoteFilters = Pick<DotDecorator, "filter" | "legacyFilters" | "unreadableFilter">;

export const FILTER_PROBLEMS = ["unreadable", "legacy"] as const;
export type FilterProblem = (typeof FILTER_PROBLEMS)[number];

export interface Dot {
	decoratorId: string;
	source: DotSource;
	shape: DotShape;
	color: DotColor;
	position: DotPosition;
}

export const MIN_DOTS = 1;
export const MAX_DOTS = 5;
export const DEFAULT_WORDS_PER_DOT = 250;

const DECORATOR_ID_PREFIX = "dots";

const SOURCE_DEFAULTS: Record<DotSource, Omit<DotDecorator, "id" | "name" | "source" | "cells" | "times" | "linkPlaces" | keyof LinkingNoteFilters>> = {
	words: { count: "perAmount", amountPerDot: DEFAULT_WORDS_PER_DOT, maxDots: MAX_DOTS, shape: "filled", color: "default", position: "below", showWithoutNote: false },
	openTasks: { count: "presence", amountPerDot: 1, maxDots: 1, shape: "hollow", color: "default", position: "below", showWithoutNote: false },
	links: { count: "presence", amountPerDot: 1, maxDots: 1, shape: "filled", color: "accent", position: "below", showWithoutNote: true },
};

export function isAmountPerDot(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function isMaxDots(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= MIN_DOTS && value <= MAX_DOTS;
}

export function sourceCanShowWithoutNote(source: DotSource): boolean {
	return source === "links";
}

export function decoratorOf(source: DotSource, id: string): DotDecorator {
	return { id, name: "", source, ...SOURCE_DEFAULTS[source], cells: [...DOT_CELLS], times: [...DOT_TIMES], linkPlaces: [], filter: emptyFilter(), legacyFilters: [] };
}

export function duplicateDecorator(decorators: readonly DotDecorator[], original: DotDecorator, name: string): DotDecorator {
	const copy: DotDecorator = structuredClone(original);
	return { ...copy, id: freeId(decorators, DECORATOR_ID_PREFIX), name };
}

export function newDecorator(decorators: readonly DotDecorator[], source: DotSource): DotDecorator {
	return decoratorOf(source, freeId(decorators, DECORATOR_ID_PREFIX));
}

export function defaultDecorators(wordsPerDot: number = DEFAULT_WORDS_PER_DOT): DotDecorator[] {
	const words = wordsPerDot > 0 ? [{ ...decoratorOf("words", "dots-1"), amountPerDot: wordsPerDot }] : [];
	return [...words, decoratorOf("openTasks", freeId(words, DECORATOR_ID_PREFIX))];
}

export function mergeDecorators(stored: unknown, legacyWordsPerDot: unknown): DotDecorator[] {
	if (!Array.isArray(stored)) return defaultDecorators(isLegacyWordsPerDot(legacyWordsPerDot) ? legacyWordsPerDot : DEFAULT_WORDS_PER_DOT);
	const decorators: DotDecorator[] = [];
	for (const entry of stored) {
		if (isRecord(entry)) decorators.push(mergeDecorator(entry, decorators));
	}
	return decorators;
}

function isLegacyWordsPerDot(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function mergeDecorator(data: Record<string, unknown>, earlier: readonly DotDecorator[]): DotDecorator {
	const source = oneOf(DOT_SOURCES, data.source, "words");
	const defaults = SOURCE_DEFAULTS[source];
	return {
		id: uniqueId(data.id, earlier, DECORATOR_ID_PREFIX),
		name: typeof data.name === "string" ? data.name : "",
		source,
		count: oneOf(DOT_COUNTS, data.count, defaults.count),
		amountPerDot: isAmountPerDot(data.amountPerDot) ? data.amountPerDot : defaults.amountPerDot,
		maxDots: isMaxDots(data.maxDots) ? data.maxDots : defaults.maxDots,
		shape: oneOf(DOT_SHAPES, data.shape, defaults.shape),
		color: oneOf(DOT_COLORS, data.color, defaults.color),
		position: oneOf(DOT_POSITIONS, data.position, defaults.position),
		showWithoutNote: typeof data.showWithoutNote === "boolean" ? data.showWithoutNote : defaults.showWithoutNote,
		cells: validCells(data.cells) ?? [...DOT_CELLS],
		times: validTimes(data.times) ?? [...DOT_TIMES],
		linkPlaces: source === "links" ? (validLinkPlaces(data.linkPlaces) ?? []) : [],
		...(source === "links" ? mergeLinkingNoteFilters(data) : { filter: emptyFilter(), legacyFilters: [] }),
	};
}

function mergeLinkingNoteFilters(data: Record<string, unknown>): LinkingNoteFilters {
	const unreadable = (stored: unknown): LinkingNoteFilters => ({ filter: emptyFilter(), legacyFilters: [], unreadableFilter: stored });
	if (data.unreadableFilter !== undefined) return unreadable(data.unreadableFilter);
	const filter = data.filter === undefined ? emptyFilter() : readFilter(data.filter);
	if (!filter) return unreadable(data.filter);
	const legacy: LegacyFilter[] = [];
	for (const stored of [data.filters, data.legacyFilters]) {
		if (stored === undefined) continue;
		const filters = readLegacyFilters(stored);
		if (!filters) return unreadable(stored);
		legacy.push(...filters);
	}
	if (filter.mode !== "all") return { filter, legacyFilters: legacy };
	const { rules, kept } = migrateLegacyFilters(legacy);
	return { filter: { ...filter, items: [...filter.items, ...rules] }, legacyFilters: kept };
}

export function filterProblem(decorator: DotDecorator): FilterProblem | undefined {
	if (decorator.source !== "links") return undefined;
	if (decorator.unreadableFilter !== undefined) return "unreadable";
	return decorator.legacyFilters.length > 0 ? "legacy" : undefined;
}

export function linkingNoteMatcher(filters: LinkingNoteFilters, context: FilterContext): (note: VaultNote) => boolean {
	if (filters.unreadableFilter !== undefined) return () => false;
	const matches = noteMatcher(filters.filter, context);
	const { legacyFilters } = filters;
	if (legacyFilters.length === 0) return matches;
	const { vault } = context;
	return (note) => matchesLegacyFilters({ path: note.path, tags: vault.tags(note.path), frontmatter: vault.frontmatter(note.path) }, legacyFilters) && matches(note);
}

const BODY_PLACE_VALUE = "body";
const ANY_PROPERTY_PLACE_VALUE = "anyProperty";
const PROPERTY_PLACE_PREFIX = "property:";

export function linkPlaceValue(place: LinkPlace): string {
	switch (place.kind) {
		case "body":
			return BODY_PLACE_VALUE;
		case "anyProperty":
			return ANY_PROPERTY_PLACE_VALUE;
		case "property":
			return PROPERTY_PLACE_PREFIX + place.name.toLowerCase();
	}
}

export function bodyPlace(): LinkPlace {
	return { kind: "body" };
}

export function anyPropertyPlace(): LinkPlace {
	return { kind: "anyProperty" };
}

export function propertyPlace(name: string): LinkPlace | undefined {
	const trimmed = name.trim();
	return trimmed === "" ? undefined : { kind: "property", name: trimmed };
}

function readLinkPlace(value: unknown): LinkPlace | undefined {
	if (!isRecord(value)) return undefined;
	if (value.kind === "body") return bodyPlace();
	if (value.kind === "anyProperty") return anyPropertyPlace();
	return value.kind === "property" && typeof value.name === "string" ? propertyPlace(value.name) : undefined;
}

export function validLinkPlaces(value: unknown): LinkPlace[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const places: LinkPlace[] = [];
	for (const stored of value) {
		const place = readLinkPlace(stored);
		if (!place || places.some((listed) => linkPlaceValue(listed) === linkPlaceValue(place))) return undefined;
		places.push(place);
	}
	return places;
}

export function linkPlacesToAdd(places: readonly LinkPlace[], propertyNames: readonly string[]): LinkPlace[] {
	const candidates = [bodyPlace(), anyPropertyPlace(), ...propertyNames.flatMap((name) => propertyPlace(name) ?? [])];
	const listed = new Set(places.map(linkPlaceValue));
	return candidates.filter((place) => {
		const value = linkPlaceValue(place);
		if (listed.has(value)) return false;
		listed.add(value);
		return true;
	});
}

export function propertyOfFrontmatterKey(key: string): string {
	return key.replace(/\.\d+$/, "");
}

function linkedFromPlace(place: LinkPlace, location: LinkLocation): boolean {
	switch (place.kind) {
		case "body":
			return location.property === undefined;
		case "anyProperty":
			return location.property !== undefined;
		case "property":
			return location.property?.toLowerCase() === place.name.toLowerCase();
	}
}

export function linkedFromPlaces(places: readonly LinkPlace[], locations: readonly LinkLocation[]): boolean {
	if (places.length === 0) return locations.length > 0;
	return locations.some((location) => places.some((place) => linkedFromPlace(place, location)));
}

export function linkReachesTarget(targetPath: string, linkpath: string, resolvedPath: string | undefined): boolean {
	if (resolvedPath !== undefined) return resolvedPath === targetPath;
	return unresolvedKeysOf(targetPath).has(unresolvedKey(linkpath));
}

export function validCells(value: unknown): DotCell[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	const cells = DOT_CELLS.filter((cell) => value.includes(cell));
	return cells.length === value.length ? cells : undefined;
}

export function cellsToAdd(cells: readonly DotCell[]): DotCell[] {
	return DOT_CELLS.filter((cell) => !cells.includes(cell));
}

export function canRemoveCell(cells: readonly DotCell[]): boolean {
	return cells.length > 1;
}

export function validTimes(value: unknown): DotTime[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	const times = DOT_TIMES.filter((time) => value.includes(time));
	return times.length === value.length ? times : undefined;
}

export function timesToAdd(times: readonly DotTime[]): DotTime[] {
	return DOT_TIMES.filter((time) => !times.includes(time));
}

export function canRemoveTime(times: readonly DotTime[]): boolean {
	return times.length > 1;
}

export function shows(decorator: DotDecorator, place: DotPlace, hasNote: boolean): boolean {
	if (!decorator.cells.includes(place.cell) || !decorator.times.includes(place.time)) return false;
	return hasNote || (sourceCanShowWithoutNote(decorator.source) && decorator.showWithoutNote);
}

export function dotCount(decorator: DotDecorator, amount: number): number {
	if (decorator.count === "presence") return amount > 0 || decorator.source === "words" ? 1 : 0;
	if (amount <= 0 && decorator.source !== "words") return 0;
	return Math.min(decorator.maxDots, Math.max(MIN_DOTS, Math.floor(amount / decorator.amountPerDot)));
}

export function previewDots(decorator: DotDecorator): Dot[] {
	const count = decorator.count === "presence" ? 1 : decorator.maxDots;
	return Array.from({ length: count }, () => dotOf(decorator));
}

function dotOf(decorator: DotDecorator): Dot {
	return { decoratorId: decorator.id, source: decorator.source, shape: decorator.shape, color: decorator.color, position: decorator.position };
}

export function dotsOfDecorators(decorators: readonly DotDecorator[], place: DotPlace, hasNote: boolean, amountOf: (decorator: DotDecorator) => number): Dot[] {
	return decorators.flatMap((decorator) => {
		if (!shows(decorator, place, hasNote)) return [];
		const dot = dotOf(decorator);
		return Array.from({ length: dotCount(decorator, amountOf(decorator)) }, () => dot);
	});
}

export interface LinkIndex {
	resolved: Readonly<Record<string, Readonly<Record<string, number>>>>;
	unresolved: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface BacklinkIndex {
	sourcesOf(targetPath: string): string[];
}

export function backlinkIndex(index: LinkIndex): BacklinkIndex {
	const resolvedSources = new Map<string, Set<string>>();
	const unresolvedSources = new Map<string, Set<string>>();
	const add = (sourcesByTarget: Map<string, Set<string>>, target: string, source: string) => {
		const sources = sourcesByTarget.get(target) ?? new Set<string>();
		sources.add(source);
		sourcesByTarget.set(target, sources);
	};
	for (const [source, targets] of Object.entries(index.resolved)) {
		for (const [target, links] of Object.entries(targets)) if (links > 0 && target !== source) add(resolvedSources, target, source);
	}
	for (const [source, targets] of Object.entries(index.unresolved)) {
		for (const target of Object.keys(targets)) add(unresolvedSources, unresolvedKey(target), source);
	}
	return {
		sourcesOf: (targetPath) => {
			const keys = unresolvedKeysOf(targetPath);
			const sources = new Set(resolvedSources.get(targetPath));
			for (const key of keys) for (const source of unresolvedSources.get(key) ?? []) sources.add(source);
			return [...sources];
		},
	};
}

function unresolvedKeysOf(targetPath: string): Set<string> {
	const withoutExtension = targetPath.replace(/\.md$/i, "");
	return new Set([withoutExtension, nameOf(withoutExtension)].map(unresolvedKey));
}

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

function unresolvedKey(linkpath: string): string {
	return linkpath.replace(/\.md$/i, "").toLowerCase();
}

function oneOf<Choice extends string>(choices: readonly Choice[], stored: unknown, fallback: Choice): Choice {
	return choices.find((choice) => choice === stored) ?? fallback;
}
