import type { NoteRef } from "../src/mentions/rows.ts";

export type V1AliasMode = "none" | "typed" | "format";

export function v1AliasOf(row: { text: string; notes: readonly NoteRef[] }, note: NoteRef, mention: { aliasMode: V1AliasMode; aliasFormat: string }): string | undefined {
	if (mention.aliasMode === "typed") return row.notes.length === 1 ? row.text : undefined;
	if (mention.aliasMode === "format") return note.start.format(mention.aliasFormat);
	return undefined;
}

function joinLinks(links: readonly string[], separator: V1Separator): string {
	if (links.length < 2) return links.join("");
	if (separator === "space") return links.join(" ");
	if (separator === "bulletLines") return links.map((link) => `- ${link}`).join("\n");
	return links.join(", ");
}

const LIST_MARKER_ONLY = /^\s*([-*+]|\d+[.)])\s+$/;

export function v1InsertionText(links: readonly string[], separator: V1Separator, textBeforeMention: string): string {
	if (links.length < 2 || separator !== "bulletLines") return joinLinks(links, separator);
	return bulletLinesText(links, textBeforeMention);
}

function indentOf(line: string): string {
	return /^\s*/.exec(line)?.[0] ?? "";
}

function isListMarkerOnly(line: string): boolean {
	return LIST_MARKER_ONLY.test(line);
}

function bulletLinesText(links: readonly string[], textBeforeMention: string): string {
	const indent = indentOf(textBeforeMention);
	const bullets = links.map((link) => `${indent}- ${link}`);
	if (isListMarkerOnly(textBeforeMention)) return [links[0], ...bullets.slice(1)].join("\n");
	if (textBeforeMention.trim() === "") return [`- ${links[0]}`, ...bullets.slice(1)].join("\n");
	return `\n${bullets.join("\n")}`;
}

export type V1Separator = "commaSpace" | "space" | "bulletLines";

export type V1Layout = "inline" | "bulletList" | "linePerItem";

export function v1SequenceInsertion(links: readonly string[], sequence: { layout: V1Layout; itemTemplate: string }, separator: V1Separator, textBeforeCursor: string): string {
	const items = links.map((link) => sequence.itemTemplate.split("{{link}}").join(link));
	switch (sequence.layout) {
		case "inline":
			return v1InsertionText(items, separator, textBeforeCursor);
		case "bulletList":
			return bulletLinesText(items, textBeforeCursor);
		case "linePerItem": {
			const indent = indentOf(textBeforeCursor);
			const continuesLine = textBeforeCursor.trim() === "" || isListMarkerOnly(textBeforeCursor);
			const lines = items.join(`\n${indent}`);
			return continuesLine ? lines : `\n${indent}${lines}`;
		}
	}
}
