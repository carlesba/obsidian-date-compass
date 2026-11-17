import { PERIODS, isRecord } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";

export const DEFAULT_MENTION_TRIGGER = "@";

export const DEFAULT_ALIAS_FORMAT = "ddd D MMM";

export const ALIAS_MODES = ["none", "typed", "format"] as const;
export type AliasMode = (typeof ALIAS_MODES)[number];

export const LINK_SEPARATORS = ["commaSpace", "space", "bulletLines"] as const;
export type LinkSeparator = (typeof LINK_SEPARATORS)[number];

export interface MentionSettings {
	enabled: boolean;
	trigger: string;
	periods: Record<Period, boolean>;
	aliasMode: AliasMode;
	aliasFormat: string;
	separator: LinkSeparator;
}

export function withoutWhitespace(trigger: string): string {
	return trigger.replace(/\s/g, "");
}

export function mergeMentions(stored: unknown): MentionSettings {
	const data = isRecord(stored) ? stored : {};
	const periods = isRecord(data.periods) ? data.periods : {};
	return {
		enabled: typeof data.enabled === "boolean" ? data.enabled : true,
		trigger: typeof data.trigger === "string" ? withoutWhitespace(data.trigger) : DEFAULT_MENTION_TRIGGER,
		periods: Object.fromEntries(PERIODS.map((period) => [period, periods[period] !== false])) as Record<Period, boolean>,
		aliasMode: ALIAS_MODES.find((mode) => mode === data.aliasMode) ?? "none",
		aliasFormat: typeof data.aliasFormat === "string" && data.aliasFormat.trim() !== "" ? data.aliasFormat.trim() : DEFAULT_ALIAS_FORMAT,
		separator: LINK_SEPARATORS.find((separator) => separator === data.separator) ?? "commaSpace",
	};
}
