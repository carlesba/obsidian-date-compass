import type { NoteRef } from "../mentions/rows.ts";
import type { LinkStyle } from "./linkStyle.ts";
import { aliasFor, renderLink } from "./render.ts";
import type { ObsidianLink } from "./render.ts";

export type LinkDestinationKind = "body" | "property";

export type LinkBuilders = Record<LinkDestinationKind, ObsidianLink>;

export interface LinksToWrite {
	destination: LinkDestinationKind;
	notes: readonly NoteRef[];
	phrase: string;
	style: Pick<LinkStyle, "template" | "aliasShape" | "aliasFormat">;
	withAlias: boolean;
	links: LinkBuilders;
}

export function linksToWrite({ destination, notes, phrase, style, withAlias, links }: LinksToWrite): string[] {
	return notes.map((note) => {
		const alias = withAlias ? aliasFor(style, phrase, notes, note) : undefined;
		if (destination === "property") return links.property(note, alias);
		return renderLink(style.template, { link: links.body(note, alias), note, alias });
	});
}
