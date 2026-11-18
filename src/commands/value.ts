import { writtenIdentity } from "../insertion/property.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { WriteMode } from "./settings.ts";

export type PropertyKind = "date" | "datetime" | "list" | "other";

const LIST_WIDGETS = ["multitext", "tags", "aliases"];

export function propertyKind(widget: string | undefined): PropertyKind {
	if (widget === "date" || widget === "datetime") return widget;
	return widget !== undefined && LIST_WIDGETS.includes(widget) ? "list" : "other";
}

export interface ValueRequest {
	notes: readonly NoteRef[];
	link: boolean;
	kind: PropertyKind;
	existingIsList: boolean;
	linkTo: (note: NoteRef) => string;
}

const TEXT_FORMATS: Record<"date" | "datetime", string> = { date: "YYYY-MM-DD", datetime: "YYYY-MM-DDTHH:mm" };

export function plainItem(note: NoteRef, kind: PropertyKind): string {
	return kind === "date" || kind === "datetime" ? note.date.format(TEXT_FORMATS[kind]) : note.name;
}

function itemOf(note: NoteRef, request: ValueRequest): string {
	return request.link ? request.linkTo(note) : plainItem(note, request.kind);
}

export function valueToWrite(request: ValueRequest): string | string[] {
	const items = request.notes.map((note) => itemOf(note, request));
	const asList = request.kind === "list" || request.existingIsList || items.length !== 1;
	return asList ? items : items[0];
}

export function effectiveMode(mode: WriteMode, kind: PropertyKind): WriteMode {
	return kind === "date" || kind === "datetime" ? "replace" : mode;
}

export type WriteRequest = Omit<ValueRequest, "existingIsList"> & { mode: WriteMode };

const TEXT_SEPARATOR = ", ";

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function identityOf(value: unknown): string {
	return writtenIdentity(String(value).trim());
}

function missingFrom(present: readonly unknown[], items: readonly string[]): string[] {
	const seen = new Set(present.map(identityOf));
	return items.filter((item) => {
		const identity = identityOf(item);
		if (seen.has(identity)) return false;
		seen.add(identity);
		return true;
	});
}

function addedTo(existing: unknown, items: readonly string[], kind: PropertyKind): unknown {
	if (Array.isArray(existing) || kind === "list") {
		const kept: unknown[] = Array.isArray(existing) ? existing : [existing];
		return [...kept, ...missingFrom(kept, items)];
	}
	const text = String(existing);
	return [text, ...missingFrom(text.split(TEXT_SEPARATOR), items)].join(TEXT_SEPARATOR);
}

function canBeAddedTo(existing: unknown): boolean {
	if (Array.isArray(existing)) return existing.length > 0;
	return !isEmpty(existing) && typeof existing !== "object";
}

export function writeToFrontmatter(frontmatter: Record<string, unknown>, property: string, request: WriteRequest): void {
	const existing = frontmatter[property];
	const replaced = valueToWrite({ ...request, existingIsList: Array.isArray(existing) });
	const adds = effectiveMode(request.mode, request.kind) === "add" && canBeAddedTo(existing);
	frontmatter[property] = adds ? addedTo(existing, typeof replaced === "string" ? [replaced] : replaced, request.kind) : replaced;
}
