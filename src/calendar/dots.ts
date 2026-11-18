export interface WordCountCache {
	get(path: string, mtime: number): number | undefined;
	set(path: string, mtime: number, words: number): void;
}

const OPEN_TASK = " ";

const UNSPACED_SCRIPTS = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}";

const SPACED_CHARACTER = `(?![${UNSPACED_SCRIPTS}])[\\p{L}\\p{M}\\p{N}]`;

const WORD = new RegExp(`[${UNSPACED_SCRIPTS}]|(?:${SPACED_CHARACTER})+(?:[-'’.,](?:${SPACED_CHARACTER})+)*`, "gu");

export function countWords(text: string): number {
	return text.match(WORD)?.length ?? 0;
}

export function openTaskCount(listItems: readonly { task?: string }[] | undefined): number {
	return listItems?.filter((item) => item.task === OPEN_TASK).length ?? 0;
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
