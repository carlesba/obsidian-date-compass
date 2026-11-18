import { isRecord } from "../dateNotes/periods.ts";
import { freeId, uniqueId } from "../settings/entryList.ts";

export const DOT_SOURCES = ["words", "openTasks", "links"] as const;
export type DotSource = (typeof DOT_SOURCES)[number];

export const DOT_COUNTS = ["presence", "perAmount"] as const;
export type DotCount = (typeof DOT_COUNTS)[number];

export const DOT_SHAPES = ["filled", "hollow"] as const;
export type DotShape = (typeof DOT_SHAPES)[number];

export const DOT_COLORS = ["default", "accent", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;
export type DotColor = (typeof DOT_COLORS)[number];

export const DOT_CELLS = ["day", "week"] as const;
export type DotCell = (typeof DOT_CELLS)[number];

export const DOT_TIMES = ["past", "current", "future"] as const;
export type DotTime = (typeof DOT_TIMES)[number];

export interface DotPlace {
	cell: DotCell;
	time: DotTime;
}

export const DOT_POSITIONS = ["below", "above", "topLeft", "topRight"] as const;
export type DotPosition = (typeof DOT_POSITIONS)[number];

export const LINK_FILTER_KINDS = ["pathStartsWith", "nameStartsWith", "tag", "property"] as const;
export type LinkFilterKind = (typeof LINK_FILTER_KINDS)[number];

export interface LinkFilter {
	kind: LinkFilterKind;
	value: string;
}

export const DECORATOR_FIELDS = ["name", "source", "count", "amountPerDot", "maxDots", "shape", "color", "position", "showWithoutNote", "cells", "times", "filters"] as const;
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
	filters: LinkFilter[];
}

export interface Dot {
	decoratorId: string;
	source: DotSource;
	shape: DotShape;
	color: DotColor;
	position: DotPosition;
}

export interface LinkingNote {
	path: string;
	tags: readonly string[];
	frontmatter: Readonly<Record<string, unknown>> | undefined;
}

export const MIN_DOTS = 1;
export const MAX_DOTS = 5;
export const DEFAULT_WORDS_PER_DOT = 250;

const DECORATOR_ID_PREFIX = "dots";

const SOURCE_DEFAULTS: Record<DotSource, Omit<DotDecorator, "id" | "name" | "source" | "cells" | "times" | "filters">> = {
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
	return { id, name: "", source, ...SOURCE_DEFAULTS[source], cells: [...DOT_CELLS], times: [...DOT_TIMES], filters: [] };
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
		filters: validFilters(data.filters) ?? [],
	};
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

export function showsEveryTime(times: readonly DotTime[]): boolean {
	return timesToAdd(times).length === 0;
}

export function validFilters(value: unknown): LinkFilter[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const filters: LinkFilter[] = [];
	for (const entry of value) {
		if (!isRecord(entry) || typeof entry.value !== "string") return undefined;
		const kind = LINK_FILTER_KINDS.find((known) => known === entry.kind);
		if (!kind) return undefined;
		filters.push({ kind, value: entry.value });
	}
	return filters;
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

export function dotsOfDecorators(decorators: readonly DotDecorator[], place: DotPlace, hasNote: boolean, amountOf: (decorator: DotDecorator) => number): Dot[] {
	return decorators.flatMap((decorator) => {
		if (!shows(decorator, place, hasNote)) return [];
		const dot: Dot = { decoratorId: decorator.id, source: decorator.source, shape: decorator.shape, color: decorator.color, position: decorator.position };
		return Array.from({ length: dotCount(decorator, amountOf(decorator)) }, () => dot);
	});
}

export function matchesFilters(note: LinkingNote, filters: readonly LinkFilter[]): boolean {
	return filters.every((filter) => matchesFilter(note, filter));
}

function matchesFilter(note: LinkingNote, { kind, value }: LinkFilter): boolean {
	const wanted = value.trim();
	if (wanted === "") return true;
	switch (kind) {
		case "pathStartsWith":
			return note.path.toLowerCase().startsWith(wanted.replace(/^\/+/, "").toLowerCase());
		case "nameStartsWith":
			return nameOf(note.path).toLowerCase().startsWith(wanted.toLowerCase());
		case "tag":
			return hasTag(note.tags, wanted);
		case "property":
			return hasProperty(note.frontmatter, wanted);
	}
}

function nameOf(path: string): string {
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

function hasProperty(frontmatter: Readonly<Record<string, unknown>> | undefined, wanted: string): boolean {
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
			const withoutExtension = targetPath.replace(/\.md$/i, "");
			const keys = new Set([withoutExtension, nameOf(withoutExtension)].map(unresolvedKey));
			const sources = new Set(resolvedSources.get(targetPath));
			for (const key of keys) for (const source of unresolvedSources.get(key) ?? []) sources.add(source);
			return [...sources];
		},
	};
}

function unresolvedKey(linkpath: string): string {
	return linkpath.replace(/\.md$/i, "").toLowerCase();
}

function oneOf<Choice extends string>(choices: readonly Choice[], stored: unknown, fallback: Choice): Choice {
	return choices.find((choice) => choice === stored) ?? fallback;
}
