import { PERIODS, isPeriod, isRecord } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";
import { LINK_PATHS } from "./linkPath.ts";
import type { LinkPath } from "./linkPath.ts";
import { ALIAS_SHAPES, DEFAULT_ALIAS_FORMAT, DEFAULT_LINK_TEMPLATE, LINK_SEPARATORS, isLinkTemplate } from "./settings.ts";
import type { AliasShape, LinkSeparator } from "./settings.ts";

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

function mergeTargets(stored: unknown): Period[] {
	const valid = Array.isArray(stored) ? (stored as unknown[]).filter(isPeriod) : [];
	const unique = valid.filter((period, index) => valid.indexOf(period) === index);
	return unique.length > 0 ? unique : [...PERIODS];
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
