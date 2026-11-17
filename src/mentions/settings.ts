import { PERIODS, isRecord } from "../dateNotes/periods.ts";
import type { Period } from "../dateNotes/periods.ts";

export const DEFAULT_MENTION_TRIGGER = "@";

export interface MentionSettings {
	enabled: boolean;
	trigger: string;
	periods: Record<Period, boolean>;
}

export function withoutWhitespace(trigger: string): string {
	return trigger.replace(/\s/g, "");
}

export function mergeMentions(stored: unknown): MentionSettings {
	const data = isRecord(stored) ? stored : {};
	const periods = isRecord(data.periods) ? data.periods : {};
	return {
		enabled: typeof data.enabled === "boolean" ? data.enabled : true,
		trigger: typeof data.trigger === "string" && withoutWhitespace(data.trigger) !== "" ? withoutWhitespace(data.trigger) : DEFAULT_MENTION_TRIGGER,
		periods: Object.fromEntries(PERIODS.map((period) => [period, periods[period] !== false])) as Record<Period, boolean>,
	};
}
