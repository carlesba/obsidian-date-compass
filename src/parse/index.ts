import { needsMoreTokens, parseTokens, type Grammar } from "./grammar.ts";
import { LANGUAGES, shared } from "./languages/index.ts";
import { resolve } from "./resolve.ts";
import { indexLexicons, normalize, rawTokens, tokenize, touchesDigits, type LexiconIndex } from "./tokenize.ts";
import type { Analysis, Completion, HintWords, Interpretation, Language, ParseOptions, Resolved, Span } from "./types.ts";

export type * from "./types.ts";
export { LANGUAGES } from "./languages/index.ts";
export { SEQUENCE_LIMIT } from "./resolve.ts";

export const DEFAULT_PARSE_OPTIONS: ParseOptions = {
	languages: ["en"],
	weekStart: "monday",
	nextWeekday: "nextWeek",
	dayMonthOrder: "dayMonth",
};

interface Parser {
	grammar: Grammar;
	index: LexiconIndex;
	hintWords: HintWords[];
}

function parserFor(options: ParseOptions): Parser {
	const languages = options.languages.map((id) => LANGUAGES[id]).filter((language): language is Language => language !== undefined);
	return { grammar: { shared, languages }, index: indexLexicons([shared, ...languages]), hintWords: languages.map((language) => language.hintWords) };
}

export function parse(text: string, now: Date, options: ParseOptions = DEFAULT_PARSE_OPTIONS): Interpretation[] {
	return interpret(text, now, options, parserFor(options)).interpretations;
}

export function parseWithRefusals(text: string, now: Date, options: ParseOptions = DEFAULT_PARSE_OPTIONS): Analysis {
	return interpret(text, now, options, parserFor(options));
}

export function itemsOf(result: Resolved): Span[] {
	return result.kind === "sequence" ? result.items : [result.span];
}

function resultKey(result: Resolved): string {
	const items = itemsOf(result);
	return `${result.kind}:${result.span.unit}:${result.span.start}:${result.span.end}:${items.length}`;
}

function interpret(text: string, now: Date, options: ParseOptions, parser: Parser): Analysis {
	const seen = new Set<string>();
	const analysis: Analysis = { interpretations: [], refusals: [] };
	for (const tokens of tokenize(text, parser.index)) {
		if (tokens.length === 0) continue;
		for (const match of parseTokens(tokens, parser.grammar)) {
			const outcome = resolve(match.node, now, options);
			if (!outcome) continue;
			if (outcome.kind === "tooManyItems") {
				const key = `refused:${JSON.stringify(match.node)}`;
				if (seen.has(key)) continue;
				seen.add(key);
				analysis.refusals.push({ language: match.language, node: match.node, reason: "tooManyItems", limit: outcome.limit });
				continue;
			}
			const key = resultKey(outcome);
			if (seen.has(key)) continue;
			seen.add(key);
			analysis.interpretations.push({ language: match.language, node: match.node, result: outcome });
		}
	}
	return analysis;
}

function needsMoreWords(text: string, parser: Parser): boolean {
	return tokenize(text, parser.index).some((tokens) => tokens.length > 0 && needsMoreTokens(tokens, parser.grammar));
}

export function complete(text: string, now: Date, options: ParseOptions = DEFAULT_PARSE_OPTIONS): Completion[] {
	const parser = parserFor(options);
	const normalized = normalize(text);
	const completions: Completion[] = [];
	const seen = new Set<string>();
	if (isHintable(normalized, now, options, parser)) return phraseHints(text.trimEnd(), now, options, parser);
	for (const candidate of completionCandidates(normalized, parser.index)) {
		if (seen.has(candidate)) continue;
		seen.add(candidate);
		const { interpretations } = interpret(candidate, now, options, parser);
		if (interpretations.length > 0 || needsMoreWords(candidate, parser)) completions.push({ text: candidate, interpretations });
	}
	return completions;
}

function completionCandidates(normalized: string, index: LexiconIndex): string[] {
	const raw = rawTokens(normalized);
	const last = raw[raw.length - 1];
	if (!last || last.kind !== "letters" || last.end !== normalized.length) return [];
	return completionStarts(raw, index).flatMap((start) => {
		const typed = normalized.slice(start);
		const shortestByMeaning = new Map<string, string>();
		for (const [key, alternatives] of index.alternatives) {
			if (key === typed || !key.startsWith(typed)) continue;
			for (const language of new Set(alternatives.map((alternative) => alternative.language))) {
				const meaning = JSON.stringify(alternatives.filter((alternative) => alternative.language === language));
				const current = shortestByMeaning.get(meaning);
				if (current === undefined || key.length < current.length) shortestByMeaning.set(meaning, key);
			}
		}
		return [...new Set(shortestByMeaning.values())]
			.sort((left, right) => left.length - right.length || left.localeCompare(right))
			.map((key) => normalized.slice(0, start) + (index.spellings.get(key) ?? key));
	});
}

function completionStarts(raw: ReturnType<typeof rawTokens>, index: LexiconIndex): number[] {
	const lastPosition = raw.length - 1;
	const starts: number[] = [];
	for (let words = 1; words <= index.maxWords && lastPosition - words + 1 >= 0; words++) {
		const first = raw[lastPosition - words + 1];
		if (first.kind !== "letters") break;
		starts.push(first.start);
	}
	const last = raw[lastPosition];
	if (touchesDigits(raw, lastPosition)) {
		for (let start = last.start + 1; start < last.end; start++) starts.push(start);
	}
	return starts;
}

const HINT_LIMIT = 6;
const HINT_MAX_WORDS = 5;
const HINT_MAX_PROBES = 3000;

function isHintable(normalized: string, now: Date, options: ParseOptions, parser: Parser): boolean {
	if (normalized.trim() === "" || interpret(normalized, now, options, parser).interpretations.length > 0) return false;
	const raw = rawTokens(normalized);
	const last = raw[raw.length - 1];
	if (last.kind === "letters" && last.end === normalized.length && isAmbiguousPrefix(last.text, parser.index)) return false;
	return tokenize(normalized, parser.index).some((tokens) => {
		const startsEvery = tokens[0]?.alternatives.some((alternative) => alternative.meaning.type === "every");
		const weekdayForBound = tokens[0]?.alternatives.some((alternative) => alternative.meaning.type === "weekday") && tokens[1]?.alternatives.some((alternative) => alternative.meaning.type === "for");
		return (startsEvery || weekdayForBound) && needsMoreTokens(tokens, parser.grammar);
	});
}

function isAmbiguousPrefix(typed: string, index: LexiconIndex): boolean {
	const own = JSON.stringify(index.alternatives.get(typed));
	if (!index.alternatives.has(typed)) return true;
	return [...index.alternatives].some(([key, alternatives]) => key !== typed && key.startsWith(typed) && JSON.stringify(alternatives) !== own);
}

function phraseHints(typed: string, now: Date, options: ParseOptions, parser: Parser): Completion[] {
	const hints: Completion[] = [];
	let frontier = [typed];
	let probes = 0;
	for (let words = 1; words <= HINT_MAX_WORDS && frontier.length > 0 && hints.length < HINT_LIMIT; words++) {
		const next: string[] = [];
		for (const prefix of frontier) {
			for (const word of hintWordsAfter(prefix, parser)) {
				if (probes++ >= HINT_MAX_PROBES || hints.length >= HINT_LIMIT) break;
				if (/^\d+$/.test(word) && endsWithTimesWord(prefix, parser)) continue;
				const candidate = `${prefix} ${word}`;
				const { interpretations } = interpret(candidate, now, options, parser);
				if (interpretations.length > 0) hints.push({ text: candidate, interpretations });
				else if (needsMoreWords(candidate, parser)) next.push(candidate);
			}
		}
		frontier = next;
	}
	return hints;
}

function endsWithTimesWord(text: string, parser: Parser): boolean {
	const last = rawTokens(normalize(text)).pop();
	return last !== undefined && (parser.index.alternatives.get(last.text) ?? []).some((alternative) => alternative.meaning.type === "times");
}

function hintWordsAfter(prefix: string, parser: Parser): string[] {
	const afterNumber = rawTokens(normalize(prefix)).pop()?.kind === "digits";
	const words = parser.hintWords.flatMap((hints) => [...hints.plain, ...(afterNumber ? hints.pluralUnits : hints.singularUnits)]);
	return [...new Set(words)];
}
