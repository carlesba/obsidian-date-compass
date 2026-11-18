import { PERIODS, isPeriod, isRecord } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";
import { LINK_PATHS } from "./linkPath.ts";
import type { LinkPath } from "./linkPath.ts";

export const DEFAULT_LINK_TEMPLATE = "{{link}}";

export const DEFAULT_ALIAS_FORMAT = "ddd D MMM";

export const LINK_SEPARATORS = ["commaSpace", "space", "bulletLines", "lines"] as const;
export type LinkSeparator = (typeof LINK_SEPARATORS)[number];

export const ALIAS_SHAPES = ["typed", "format"] as const;
export type AliasShape = (typeof ALIAS_SHAPES)[number];

export const LINK_STYLE_FIELDS = ["targets", "template", "linkPath", "separator", "aliasShape", "aliasFormat"] as const;
export type LinkStyleField = (typeof LINK_STYLE_FIELDS)[number];

export function isLinkTemplate(value: string): boolean {
	return value.trim() !== "";
}

export interface LinkStyle {
	targets: Period[];
	template: string;
	linkPath: LinkPath;
	separator: LinkSeparator;
	aliasShape: AliasShape;
	aliasFormat: string;
}

export function defaultLinkStyle(): LinkStyle {
	return {
		targets: [...PERIODS],
		template: DEFAULT_LINK_TEMPLATE,
		linkPath: "shortestWhenSafe",
		separator: "commaSpace",
		aliasShape: "format",
		aliasFormat: DEFAULT_ALIAS_FORMAT,
	};
}

export function mergeLinkStyle(stored: unknown): LinkStyle {
	const data = isRecord(stored) ? stored : {};
	const defaults = defaultLinkStyle();
	return {
		targets: mergeTargets(data.targets),
		template: typeof data.template === "string" && isLinkTemplate(data.template) ? data.template : defaults.template,
		linkPath: LINK_PATHS.find((linkPath) => linkPath === data.linkPath) ?? defaults.linkPath,
		separator: LINK_SEPARATORS.find((separator) => separator === data.separator) ?? defaults.separator,
		aliasShape: ALIAS_SHAPES.find((shape) => shape === data.aliasShape) ?? defaults.aliasShape,
		aliasFormat: typeof data.aliasFormat === "string" && data.aliasFormat.trim() !== "" ? data.aliasFormat.trim() : defaults.aliasFormat,
	};
}

export function validTargets(stored: unknown): Period[] {
	const valid = Array.isArray(stored) ? (stored as unknown[]).filter(isPeriod) : [];
	return valid.filter((period, index) => valid.indexOf(period) === index);
}

function mergeTargets(stored: unknown): Period[] {
	const targets = validTargets(stored);
	return targets.length > 0 ? targets : [...PERIODS];
}

export function effectiveTargets(targets: readonly Period[], isEnabledInDateNotes: (period: Period) => boolean): Period[] {
	return targets.filter(isEnabledInDateNotes);
}

export function targetsToAdd(targets: readonly Period[]): Period[] {
	return PERIODS.filter((period) => !targets.includes(period));
}

export function canRemoveTarget(targets: readonly Period[]): boolean {
	return targets.length > 1;
}

export function addTarget(targets: readonly Period[], period: Period): Period[] {
	return targets.includes(period) ? [...targets] : [...targets, period];
}

export function removeTarget(targets: readonly Period[], period: Period): Period[] {
	return canRemoveTarget(targets) ? targets.filter((kept) => kept !== period) : [...targets];
}
