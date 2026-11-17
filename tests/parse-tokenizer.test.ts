import { test } from "node:test";
import { strict as assert } from "node:assert";
import { indexLexicons, normalize, tokenize } from "../src/parse/tokenize.ts";
import type { Language, Token } from "../src/parse/types.ts";
import { en } from "../src/parse/languages/en.ts";
import { shared } from "../src/parse/languages/shared.ts";

const sample: Language = {
	id: "sample",
	lexicon: [
		{ words: ["pasado"], meaning: { type: "last" } },
		{ words: ["mañana"], meaning: { type: "relativeDay", value: 1 } },
		{ words: ["pasado mañana"], meaning: { type: "relativeDay", value: 2 } },
		{ words: ["miércoles"], meaning: { type: "weekday", value: 3 } },
		{ words: ["mar"], meaning: { type: "weekday", value: 2 } },
	],
	shapes: [],
};

const index = indexLexicons([shared, en, sample]);

function texts(stream: Token[]): string[] {
	return stream.map((token) => token.text);
}

test("text is lowercased and accents are stripped", () => {
	assert.equal(normalize("Miércoles MAÑANA"), "miercoles manana");
	assert.deepEqual(tokenize("Miércoles", index).map(texts), [["miercoles"]]);
	assert.deepEqual(tokenize("miercoles", index)[0][0].alternatives, [{ language: "sample", meaning: { type: "weekday", value: 3 } }]);
});

test("digits and letters split where they meet", () => {
	assert.deepEqual(tokenize("40d", index).map(texts), [["40", "d"]]);
	assert.deepEqual(tokenize("2026-W48", index).map(texts), [["2026", "-", "w", "48"]]);
	assert.deepEqual(tokenize("3/12", index).map(texts), [["3", "/", "12"]]);
	assert.deepEqual(tokenize("3rd", index).map(texts), [["3", "rd"]]);
});

test("a letter run glued to digits is segmented into lexicon words", () => {
	assert.deepEqual(tokenize("3daysago", index).map(texts), [["3", "days", "ago"]]);
	assert.deepEqual(tokenize("3dago", index).map(texts), [["3", "d", "ago"]]);
});

test("a letter run not touching digits is never segmented", () => {
	assert.deepEqual(tokenize("aday", index).map(texts), [["aday"]]);
	assert.deepEqual(tokenize("aday", index)[0][0].alternatives, []);
});

test("the longest lexicon phrase wins", () => {
	assert.deepEqual(tokenize("pasado mañana", index).map(texts), [["pasado manana"]]);
	assert.deepEqual(tokenize("pasado mañana", index)[0][0].alternatives, [{ language: "sample", meaning: { type: "relativeDay", value: 2 } }]);
	assert.deepEqual(tokenize("mañana pasado", index).map(texts), [["manana", "pasado"]]);
});

test("a word with meanings in several languages keeps every meaning", () => {
	assert.deepEqual(tokenize("mar", index)[0][0].alternatives, [
		{ language: "en", meaning: { type: "month", value: 3 } },
		{ language: "sample", meaning: { type: "weekday", value: 2 } },
	]);
});
