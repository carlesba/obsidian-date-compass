import { isRecord } from "../dateNotes/periods.ts";
import { defaultLinkStyle, mergeLinkStyle } from "../insertion/linkStyle.ts";
import type { LinkStyle } from "../insertion/linkStyle.ts";
import { freeId, uniqueId } from "../settings/entryList.ts";

export const DEFAULT_MENTION_TRIGGER = "@";

const NEW_MENTION_TRIGGERS = [DEFAULT_MENTION_TRIGGER, "@@", "!", "&", "+"];

const MENTION_ID_PREFIX = "mention";

export const MENTION_FIELDS = ["trigger"] as const;
export type MentionField = (typeof MENTION_FIELDS)[number];

export interface Mention extends LinkStyle {
	id: string;
	trigger: string;
}

export function withoutWhitespace(trigger: string): string {
	return trigger.replace(/\s/g, "");
}

export function defaultMentions(): Mention[] {
	return [{ ...defaultLinkStyle(), id: freeId([], MENTION_ID_PREFIX), trigger: DEFAULT_MENTION_TRIGGER }];
}

export function mergeMentions(stored: unknown): Mention[] {
	if (!Array.isArray(stored)) return defaultMentions();
	const mentions: Mention[] = [];
	for (const entry of stored) {
		if (!isRecord(entry)) continue;
		const trigger = typeof entry.trigger === "string" ? withoutWhitespace(entry.trigger) : "";
		mentions.push({
			...mergeLinkStyle(entry),
			id: uniqueId(entry.id, mentions, MENTION_ID_PREFIX),
			trigger: trigger === "" ? DEFAULT_MENTION_TRIGGER : trigger,
		});
	}
	return mentions;
}

export function newMention(mentions: readonly Mention[]): Mention {
	return { ...defaultLinkStyle(), id: freeId(mentions, MENTION_ID_PREFIX), trigger: unusedTrigger(mentions.map((mention) => mention.trigger)) };
}

function unusedTrigger(used: readonly string[]): string {
	const offered = NEW_MENTION_TRIGGERS.find((trigger) => !used.includes(trigger));
	if (offered) return offered;
	for (let length = 3; ; length++) {
		const repeated = DEFAULT_MENTION_TRIGGER.repeat(length);
		if (!used.includes(repeated)) return repeated;
	}
}
