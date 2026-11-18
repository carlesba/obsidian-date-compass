import { propertyAtLine } from "../insertion/destination.ts";

export interface MentionMatch {
	start: number;
	query: string;
}

const WHITESPACE = /\s/;

const CODE_FENCE = /^\s*(```|~~~)/;

const FRONTMATTER_FENCE = "---";

export function mentionAt(lineBeforeCaret: string, trigger: string): MentionMatch | undefined {
	if (!trigger) return undefined;
	for (let start = lineBeforeCaret.lastIndexOf(trigger); start >= 0; start = lineBeforeCaret.lastIndexOf(trigger, start - 1)) {
		const query = lineBeforeCaret.slice(start + trigger.length);
		const before = lineBeforeCaret[start - 1];
		if (WHITESPACE.test(query[0] ?? "")) return undefined;
		if (before === undefined || WHITESPACE.test(before)) return { start, query };
		if (start === 0) return undefined;
	}
	return undefined;
}

export interface ActiveMention<M extends { trigger: string }> {
	mention: M;
	match: MentionMatch;
}

export function activeMentionAt<M extends { trigger: string }>(lineBeforeCaret: string, mentions: readonly M[]): ActiveMention<M> | undefined {
	let active: ActiveMention<M> | undefined;
	for (const mention of mentions) {
		const match = mentionAt(lineBeforeCaret, mention.trigger);
		if (match && (!active || startsLater(match, mention, active))) active = { mention, match };
	}
	return active;
}

function startsLater(match: MentionMatch, mention: { trigger: string }, active: ActiveMention<{ trigger: string }>): boolean {
	if (match.start !== active.match.start) return match.start > active.match.start;
	return mention.trigger.length > active.mention.trigger.length;
}

export interface Dismissal {
	position: string;
	deadEndQuery?: string;
}

export function isDismissed(dismissal: Dismissal | undefined, position: string, query: string): boolean {
	if (!dismissal || dismissal.position !== position) return false;
	return dismissal.deadEndQuery === undefined || query.startsWith(dismissal.deadEndQuery);
}

export function mayOpenMentionAt(lines: readonly string[], cursorLine: number, lineBeforeCaret: string): boolean {
	const linesAbove = lines.slice(0, cursorLine);
	if (isInCode(linesAbove, lineBeforeCaret)) return false;
	return !isInFrontmatter(linesAbove) || propertyAtLine(lines, cursorLine) !== undefined;
}

export function isInCode(linesAbove: readonly string[], lineBeforeCaret: string): boolean {
	const fences = linesAbove.filter((line) => CODE_FENCE.test(line)).length;
	if (fences % 2 === 1) return true;
	const backticks = lineBeforeCaret.split("`").length - 1;
	return backticks % 2 === 1;
}

function isInFrontmatter(linesAbove: readonly string[]): boolean {
	if (linesAbove[0]?.trim() !== FRONTMATTER_FENCE) return false;
	return !linesAbove.slice(1).some((line) => line.trim() === FRONTMATTER_FENCE);
}

const CONTINUATIONS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

export function isDeadEnd(query: string, mayMatch: (text: string) => boolean): boolean {
	if (!WHITESPACE.test(query)) return false;
	if (mayMatch(query)) return false;
	const continuations = WHITESPACE.test(query[query.length - 1] ?? "") ? CONTINUATIONS : CONTINUATIONS.map((next) => ` ${next}`);
	return !continuations.some((next) => mayMatch(query + next));
}
