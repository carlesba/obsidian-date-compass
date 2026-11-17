import type { NoteRef } from "../mentions/rows.ts";
import type { InsertionSettings, LinkSeparator } from "./settings.ts";

const TEMPLATE_VARIABLE = /\{\{(link|name|path|alias)\}\}|\{\{date:([^}]*)\}\}/g;

export interface LinkParts {
	link: string;
	note: NoteRef;
	alias: string | undefined;
}

export function renderLink(template: string, { link, note, alias }: LinkParts): string {
	const values = { link, name: note.name, path: note.path, alias: alias ?? "" };
	return template.replace(TEMPLATE_VARIABLE, (_match, variable: keyof typeof values | undefined, dateFormat: string | undefined) =>
		variable === undefined ? note.start.format(dateFormat) : values[variable],
	);
}

export function aliasFor(insertion: Pick<InsertionSettings, "aliasShape" | "aliasFormat">, phrase: string, notes: readonly NoteRef[], note: NoteRef): string | undefined {
	if (insertion.aliasShape === "typed") return notes.length === 1 ? phrase : undefined;
	return note.start.format(insertion.aliasFormat);
}

export function usesAlias(insertion: Pick<InsertionSettings, "aliasByDefault">, flipped: boolean): boolean {
	return insertion.aliasByDefault !== flipped;
}

export type ObsidianLink = (note: NoteRef, alias: string | undefined) => string;

export function insertionLinks(notes: readonly NoteRef[], phrase: string, insertion: InsertionSettings, withAlias: boolean, obsidianLink: ObsidianLink): string[] {
	return notes.map((note) => {
		const alias = withAlias ? aliasFor(insertion, phrase, notes, note) : undefined;
		return renderLink(insertion.linkTemplate, { link: obsidianLink(note, alias), note, alias });
	});
}

export function formattedItems(items: readonly string[], notes: readonly NoteRef[], linkTemplate: string): string[] {
	return items.map((link, index) => renderLink(linkTemplate, { link, note: notes[index], alias: undefined }));
}

function joinLinks(links: readonly string[], separator: LinkSeparator): string {
	if (links.length < 2) return links.join("");
	if (separator === "space") return links.join(" ");
	if (separator === "bulletLines") return links.map((link) => `- ${link}`).join("\n");
	return links.join(", ");
}

const LIST_MARKER_ONLY = /^\s*([-*+]|\d+[.)])\s+$/;

export function insertionText(links: readonly string[], separator: LinkSeparator, textBeforeInsertion: string): string {
	if (separator === "lines") return linesText(links, textBeforeInsertion);
	if (links.length < 2 || separator !== "bulletLines") return joinLinks(links, separator);
	return bulletLinesText(links, textBeforeInsertion);
}

export function indentOf(line: string): string {
	return /^\s*/.exec(line)?.[0] ?? "";
}

export function isListMarkerOnly(line: string): boolean {
	return LIST_MARKER_ONLY.test(line);
}

function bulletLinesText(links: readonly string[], textBeforeInsertion: string): string {
	const indent = indentOf(textBeforeInsertion);
	const bullets = links.map((link) => `${indent}- ${link}`);
	if (isListMarkerOnly(textBeforeInsertion)) return [links[0], ...bullets.slice(1)].join("\n");
	if (textBeforeInsertion.trim() === "") return [`- ${links[0]}`, ...bullets.slice(1)].join("\n");
	return `\n${bullets.join("\n")}`;
}

function linesText(links: readonly string[], textBeforeInsertion: string): string {
	const indent = indentOf(textBeforeInsertion);
	const continuesLine = textBeforeInsertion.trim() === "" || isListMarkerOnly(textBeforeInsertion);
	const lines = links.join(`\n${indent}`);
	return continuesLine ? lines : `\n${indent}${lines}`;
}
