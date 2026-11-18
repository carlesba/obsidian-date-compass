import { isRecord } from "../dateNotes/periods.ts";
import { LINK_PATHS } from "./linkPath.ts";
import type { LinkPath } from "./linkPath.ts";

export const DEFAULT_LINK_TEMPLATE = "{{link}}";

export const DEFAULT_ALIAS_FORMAT = "ddd D MMM";

export const LINK_SEPARATORS = ["commaSpace", "space", "bulletLines", "lines"] as const;
export type LinkSeparator = (typeof LINK_SEPARATORS)[number];

export const ALIAS_SHAPES = ["typed", "format"] as const;
export type AliasShape = (typeof ALIAS_SHAPES)[number];

export interface InsertionSettings {
	linkPath: LinkPath;
	linkTemplate: string;
	separator: LinkSeparator;
	aliasShape: AliasShape;
	aliasFormat: string;
	aliasByDefault: boolean;
}

export function isLinkTemplate(value: string): boolean {
	return value.trim() !== "";
}

export function mergeInsertion(stored: unknown, storedMentions?: unknown, storedSequence?: unknown): InsertionSettings {
	if (isRecord(stored)) return readInsertion(stored);
	return readInsertion(migratedFromV1(storedMentions, storedSequence));
}

function readInsertion(data: Record<string, unknown>): InsertionSettings {
	return {
		linkPath: LINK_PATHS.find((linkPath) => linkPath === data.linkPath) ?? "shortestWhenSafe",
		linkTemplate: typeof data.linkTemplate === "string" && isLinkTemplate(data.linkTemplate) ? data.linkTemplate : DEFAULT_LINK_TEMPLATE,
		separator: LINK_SEPARATORS.find((separator) => separator === data.separator) ?? "commaSpace",
		aliasShape: ALIAS_SHAPES.find((shape) => shape === data.aliasShape) ?? "format",
		aliasFormat: typeof data.aliasFormat === "string" && data.aliasFormat.trim() !== "" ? data.aliasFormat.trim() : DEFAULT_ALIAS_FORMAT,
		aliasByDefault: data.aliasByDefault === true,
	};
}

function migratedFromV1(storedMentions: unknown, storedSequence: unknown): Record<string, unknown> {
	const mentions = isRecord(storedMentions) ? storedMentions : {};
	const sequence = isRecord(storedSequence) ? storedSequence : {};
	const aliasMode = mentions.aliasMode;
	return {
		linkTemplate: typeof sequence.itemTemplate === "string" && sequence.itemTemplate.includes(DEFAULT_LINK_TEMPLATE) ? sequence.itemTemplate : DEFAULT_LINK_TEMPLATE,
		separator: separatorFromV1(mentions.separator, sequence.layout),
		aliasShape: aliasMode === "typed" ? "typed" : "format",
		aliasFormat: mentions.aliasFormat,
		aliasByDefault: aliasMode === "typed" || aliasMode === "format",
	};
}

function separatorFromV1(separator: unknown, layout: unknown): unknown {
	if (layout === "bulletList") return "bulletLines";
	if (layout === "linePerItem") return "lines";
	return separator;
}
