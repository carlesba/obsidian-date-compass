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

export function mergeInsertion(stored: unknown): InsertionSettings {
	const data = isRecord(stored) ? stored : {};
	return {
		linkPath: LINK_PATHS.find((linkPath) => linkPath === data.linkPath) ?? "shortestWhenSafe",
		linkTemplate: typeof data.linkTemplate === "string" && isLinkTemplate(data.linkTemplate) ? data.linkTemplate : DEFAULT_LINK_TEMPLATE,
		separator: LINK_SEPARATORS.find((separator) => separator === data.separator) ?? "commaSpace",
		aliasShape: ALIAS_SHAPES.find((shape) => shape === data.aliasShape) ?? "format",
		aliasFormat: typeof data.aliasFormat === "string" && data.aliasFormat.trim() !== "" ? data.aliasFormat.trim() : DEFAULT_ALIAS_FORMAT,
		aliasByDefault: data.aliasByDefault === true,
	};
}
