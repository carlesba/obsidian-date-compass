export interface Dot {
	filled: boolean;
}

export interface NoteFacts {
	words: number;
	hasOpenTask: boolean;
}

export interface WordCountCache {
	get(path: string, mtime: number): number | undefined;
	set(path: string, mtime: number, words: number): void;
}

export const MAX_WORD_DOTS = 5;

const OPEN_TASK = " ";

const UNSPACED_SCRIPTS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}";

const SPACED_CHARACTER = `(?![${UNSPACED_SCRIPTS}])[\\p{L}\\p{M}\\p{N}]`;

const WORD = new RegExp(`[${UNSPACED_SCRIPTS}]|(?:${SPACED_CHARACTER})+(?:[-'’.,](?:${SPACED_CHARACTER})+)*`, "gu");

export function countWords(text: string): number {
	return text.match(WORD)?.length ?? 0;
}

export function hasOpenTask(listItems: readonly { task?: string }[] | undefined): boolean {
	return listItems?.some((item) => item.task === OPEN_TASK) ?? false;
}

export function wordDots(words: number, wordsPerDot: number): number {
	if (wordsPerDot <= 0) return 0;
	return Math.min(MAX_WORD_DOTS, Math.max(0, Math.floor(words / wordsPerDot)));
}

export function dotsOf(facts: NoteFacts, wordsPerDot: number): Dot[] {
	const filled = Array.from({ length: wordDots(facts.words, wordsPerDot) }, () => ({ filled: true }));
	return facts.hasOpenTask ? [...filled, { filled: false }] : filled;
}

export function wordCountCache(): WordCountCache {
	const counted = new Map<string, { mtime: number; words: number }>();
	return {
		get: (path, mtime) => {
			const entry = counted.get(path);
			if (!entry) return undefined;
			if (entry.mtime === mtime) return entry.words;
			counted.delete(path);
			return undefined;
		},
		set: (path, mtime, words) => void counted.set(path, { mtime, words }),
	};
}
