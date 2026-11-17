import type { Category, Element, Language, Part, ParsedNode, Shape, Token } from "./types.ts";

export interface Match {
	language: string;
	node: ParsedNode;
	end: number;
}

export interface Grammar {
	shared: Language;
	languages: Language[];
}

export function parseTokens(tokens: Token[], grammar: Grammar): Match[] {
	return [grammar.shared, ...grammar.languages].flatMap((language) =>
		language.shapes
			.flatMap((shape) => matchShape(tokens, 0, shape, language, grammar))
			.filter((match) => match.end === tokens.length),
	);
}

function shapesFor(language: Language, grammar: Grammar): Language[] {
	return language.id === grammar.shared.id ? [language] : [language, grammar.shared];
}

function matchCategory(tokens: Token[], position: number, category: Category, language: Language, grammar: Grammar): Match[] {
	return shapesFor(language, grammar).flatMap((owner) =>
		owner.shapes
			.filter((shape) => shape.produces === category)
			.flatMap((shape) => matchShape(tokens, position, shape, language, grammar)),
	);
}

function matchShape(tokens: Token[], position: number, shape: Shape, language: Language, grammar: Grammar): Match[] {
	return matchElements(tokens, position, shape.elements, language, grammar).flatMap(({ parts, end }) => {
		const node = shape.build(parts);
		return node ? [{ language: language.id, node, end }] : [];
	});
}

function matchElements(tokens: Token[], position: number, elements: Element[], language: Language, grammar: Grammar): Array<{ parts: Part[]; end: number }> {
	if (elements.length === 0) return [{ parts: [], end: position }];
	const [element, ...rest] = elements;
	return matchElement(tokens, position, element, language, grammar).flatMap((head) =>
		matchElements(tokens, head.end, rest, language, grammar).map((tail) => ({ parts: [head.part, ...tail.parts], end: tail.end })),
	);
}

function matchElement(tokens: Token[], position: number, element: Element, language: Language, grammar: Grammar): Array<{ part: Part; end: number }> {
	if ("node" in element) {
		return matchCategory(tokens, position, element.node, language, grammar).map((match) => ({ part: { type: "node", value: match.node }, end: match.end }));
	}
	const token = tokens[position];
	if (!token) return [];
	const readable = language.id === grammar.shared.id ? [language.id] : [language.id, grammar.shared.id];
	return token.alternatives
		.filter((alternative) => readable.includes(alternative.language))
		.map((alternative) => alternative.meaning)
		.filter((meaning) => meaning.type === element.type && (element.test?.(meaning) ?? true))
		.map((meaning) => ({ part: meaning, end: position + 1 }));
}
