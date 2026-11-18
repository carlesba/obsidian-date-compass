import type { Alternative, Language, Token } from "./types.ts";

export interface LexiconIndex {
	alternatives: Map<string, Alternative[]>;
	spellings: Map<string, string>;
	maxWords: number;
}

interface RawToken {
	kind: "digits" | "letters" | "symbol";
	text: string;
	start: number;
	end: number;
}

const RAW_TOKEN = /\d+|\p{L}+|[^\s\p{L}\d]/gu;
const STREAM_LIMIT = 16;

export function normalize(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function indexLexicons(languages: Language[]): LexiconIndex {
	const alternatives = new Map<string, Alternative[]>();
	const spellings = new Map<string, string>();
	let maxWords = 1;
	for (const language of languages) {
		for (const entry of language.lexicon) {
			for (const word of entry.words) {
				const key = normalize(word).split(/\s+/).join(" ");
				alternatives.set(key, [...(alternatives.get(key) ?? []), { language: language.id, meaning: entry.meaning }]);
				if (!spellings.has(key)) spellings.set(key, word);
				maxWords = Math.max(maxWords, key.split(" ").length);
			}
		}
	}
	return { alternatives, spellings, maxWords };
}

export function rawTokens(normalized: string): RawToken[] {
	const pattern = new RegExp(RAW_TOKEN.source, RAW_TOKEN.flags);
	const tokens: RawToken[] = [];
	for (let match = pattern.exec(normalized); match !== null; match = pattern.exec(normalized)) {
		const text = match[0];
		const start = match.index;
		const kind = /^\d/.test(text) ? "digits" : /^\p{L}/u.test(text) ? "letters" : "symbol";
		tokens.push({ kind, text, start, end: start + text.length });
	}
	return tokens;
}

export function touchesDigits(tokens: RawToken[], position: number): boolean {
	const token = tokens[position];
	const previous = tokens[position - 1];
	const next = tokens[position + 1];
	return (previous?.kind === "digits" && previous.end === token.start) || (next?.kind === "digits" && next.start === token.end);
}

export function segmentations(letters: string, index: LexiconIndex): string[][] {
	if (letters.length === 0) return [[]];
	const found: string[][] = [];
	for (let length = letters.length; length >= 1; length--) {
		const head = letters.slice(0, length);
		if (!index.alternatives.has(head)) continue;
		for (const rest of segmentations(letters.slice(length), index)) {
			found.push([head, ...rest]);
			if (found.length >= STREAM_LIMIT) return found;
		}
	}
	return found;
}

export function tokenize(text: string, index: LexiconIndex): Token[][] {
	const raw = rawTokens(normalize(text));
	let streams: RawToken[][] = [[]];
	raw.forEach((token, position) => {
		const variants = wordVariants(raw, position, index);
		streams = streams.flatMap((stream) => variants.map((variant) => [...stream, ...variant])).slice(0, STREAM_LIMIT);
	});
	return streams.map((stream) => groupWords(stream, index));
}

function wordVariants(raw: RawToken[], position: number, index: LexiconIndex): RawToken[][] {
	const token = raw[position];
	if (token.kind !== "letters" || index.alternatives.has(token.text) || !touchesDigits(raw, position)) return [[token]];
	const splits = segmentations(token.text, index);
	if (splits.length === 0) return [[token]];
	return splits.map((words) => words.map((word) => ({ ...token, text: word })));
}

function groupWords(stream: RawToken[], index: LexiconIndex): Token[] {
	const tokens: Token[] = [];
	let position = 0;
	while (position < stream.length) {
		const token = stream[position];
		if (token.kind === "digits") {
			tokens.push({ text: token.text, alternatives: [{ language: "shared", meaning: { type: "number", value: Number(token.text), digits: token.text.length } }] });
			position += 1;
			continue;
		}
		if (token.kind === "symbol") {
			tokens.push({ text: token.text, alternatives: [{ language: "shared", meaning: { type: "symbol", value: token.text } }] });
			position += 1;
			continue;
		}
		const match = longestWordMatch(stream, position, index);
		tokens.push({ text: match.key, alternatives: index.alternatives.get(match.key) ?? [] });
		position += match.length;
	}
	return tokens;
}

function longestWordMatch(stream: RawToken[], position: number, index: LexiconIndex): { key: string; length: number } {
	for (let length = Math.min(index.maxWords, stream.length - position); length > 1; length--) {
		const words = stream.slice(position, position + length);
		if (words.some((word) => word.kind !== "letters")) continue;
		const key = words.map((word) => word.text).join(" ");
		if (index.alternatives.has(key)) return { key, length };
	}
	return { key: stream[position].text, length: 1 };
}
