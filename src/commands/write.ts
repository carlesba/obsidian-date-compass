import type { DatesDestination } from "../insertion/destination.ts";
import { effectiveDestination } from "../insertion/destination.ts";
import { linksToWrite } from "../insertion/linksToWrite.ts";
import type { LinkBuilders } from "../insertion/linksToWrite.ts";
import { aliasFor } from "../insertion/render.ts";
import type { NoteRef } from "../mentions/rows.ts";
import type { DateCommand, WriteMode } from "./settings.ts";
import { plainItem } from "./value.ts";
import type { PropertyKind } from "./value.ts";

export type PropertyTarget = { kind: "property"; property: string; mode: WriteMode };

export type CursorTarget = { kind: "body" } | { kind: "propertyUnderCursor"; property: string } | { kind: "noProperty" };

export type WriteTarget = PropertyTarget | Exclude<CursorTarget, { kind: "noProperty" }>;

export function propertyTarget(command: Pick<DateCommand, "property" | "mode">): PropertyTarget {
	return { kind: "property", property: command.property.trim(), mode: command.mode };
}

export function cursorTarget(destination: DatesDestination, hasFile: boolean): CursorTarget {
	const effective = effectiveDestination(destination, hasFile);
	if (effective.kind === "body") return { kind: "body" };
	return effective.kind === "property" ? { kind: "propertyUnderCursor", property: effective.name } : { kind: "noProperty" };
}

export function offersAlias(command: Pick<DateCommand, "link">, target: WriteTarget, kind: PropertyKind): boolean {
	if (target.kind === "body") return true;
	return command.link && kind !== "date" && kind !== "datetime";
}

export function aliasChosen(offered: boolean, keys: { altKey: boolean }): boolean {
	return offered && keys.altKey;
}

export interface CommandAnswer {
	notes: readonly NoteRef[];
	phrase: string;
	withAlias: boolean;
}

export interface CommandWrite extends CommandAnswer {
	command: Pick<DateCommand, "link" | "template" | "aliasShape" | "aliasFormat">;
	target: WriteTarget;
	kind: PropertyKind;
	links: LinkBuilders;
}

export function aliasedPropertyLink({ command, target, kind, notes, phrase, withAlias, links }: CommandWrite): (note: NoteRef) => string {
	const aliased = withAlias && offersAlias(command, target, kind);
	return (note) => links.property(note, aliased ? aliasFor(command, phrase, notes, note) : undefined);
}

const PLAIN_TEXT: LinkBuilders = {
	body: (note, alias) => alias ?? note.name,
	property: (note) => note.name,
};

export function textsToWrite(write: CommandWrite): string[] {
	const { command, target, kind, notes, phrase, withAlias, links } = write;
	if (target.kind !== "body") return notes.map(command.link ? aliasedPropertyLink(write) : (note) => plainItem(note, kind));
	return linksToWrite({ destination: "body", notes, phrase, style: command, withAlias, links: command.link ? links : PLAIN_TEXT });
}
