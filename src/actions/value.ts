import type { NoteRef } from "../mentions/rows.ts";

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

function itemOf(note: NoteRef, request: ValueRequest): string {
	if (request.link) return request.linkTo(note);
	if (request.kind === "date" || request.kind === "datetime") return note.date.format(TEXT_FORMATS[request.kind]);
	return note.name;
}

export function valueToWrite(request: ValueRequest): string | string[] {
	const items = request.notes.map((note) => itemOf(note, request));
	const asList = request.kind === "list" || request.existingIsList || items.length !== 1;
	return asList ? items : items[0];
}
