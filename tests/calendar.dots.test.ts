import { test } from "node:test";
import { strict as assert } from "node:assert";
import { countWords, dotsOf, hasOpenTask, wordCountCache } from "../src/calendar/dots.ts";

const FILLED = { filled: true };
const HOLLOW = { filled: false };

test("words are counted across punctuation, numbers, accents and scripts without spaces", () => {
	assert.equal(countWords(""), 0);
	assert.equal(countWords("One two, three."), 3);
	assert.equal(countWords("A well-known rule: don't count 3.5 twice"), 7);
	assert.equal(countWords("Mañana será otro día"), 4);
	assert.equal(countWords("- [ ] call the bank\n- [x] done"), 5);
	assert.equal(countWords("日本語 text"), 4);
	assert.equal(countWords("--- ... !!!"), 0);
});

test("a note shows one filled dot per full batch of words, at least one and at most five", () => {
	assert.deepEqual(dotsOf({ words: 0, hasOpenTask: false }, 250), [FILLED]);
	assert.deepEqual(dotsOf({ words: 249, hasOpenTask: false }, 250), [FILLED]);
	assert.deepEqual(dotsOf({ words: 250, hasOpenTask: false }, 250), [FILLED]);
	assert.deepEqual(dotsOf({ words: 499, hasOpenTask: false }, 250), [FILLED]);
	assert.deepEqual(dotsOf({ words: 749, hasOpenTask: false }, 250), [FILLED, FILLED]);
	assert.deepEqual(dotsOf({ words: 1250, hasOpenTask: false }, 250), [FILLED, FILLED, FILLED, FILLED, FILLED]);
	assert.deepEqual(dotsOf({ words: 90_000, hasOpenTask: false }, 250), [FILLED, FILLED, FILLED, FILLED, FILLED]);
	assert.deepEqual(dotsOf({ words: 30, hasOpenTask: false }, 10), [FILLED, FILLED, FILLED]);
});

test("0 words per dot turns word dots off", () => {
	assert.deepEqual(dotsOf({ words: 0, hasOpenTask: false }, 0), []);
	assert.deepEqual(dotsOf({ words: 5000, hasOpenTask: false }, 0), []);
	assert.deepEqual(dotsOf({ words: 5000, hasOpenTask: true }, 0), [HOLLOW]);
});

test("an open task adds one hollow dot after the filled ones", () => {
	assert.deepEqual(dotsOf({ words: 0, hasOpenTask: true }, 250), [FILLED, HOLLOW]);
	assert.deepEqual(dotsOf({ words: 500, hasOpenTask: true }, 250), [FILLED, FILLED, HOLLOW]);
	assert.deepEqual(dotsOf({ words: 5000, hasOpenTask: true }, 250), [FILLED, FILLED, FILLED, FILLED, FILLED, HOLLOW]);
});

test("a note has an open task when any list item is an unchecked task", () => {
	assert.equal(hasOpenTask(undefined), false);
	assert.equal(hasOpenTask([]), false);
	assert.equal(hasOpenTask([{}, { task: undefined }]), false);
	assert.equal(hasOpenTask([{ task: "x" }, { task: "-" }]), false);
	assert.equal(hasOpenTask([{ task: "x" }, { task: " " }]), true);
});

test("word counts are remembered per path until the file's modification time changes", () => {
	const cache = wordCountCache();
	assert.equal(cache.get("2026-11-17.md", 100), undefined);
	cache.set("2026-11-17.md", 100, 420);
	cache.set("2026-11-18.md", 100, 7);
	assert.equal(cache.get("2026-11-17.md", 100), 420);
	assert.equal(cache.get("2026-11-18.md", 100), 7);
	assert.equal(cache.get("2026-11-17.md", 200), undefined);
	assert.equal(cache.get("2026-11-17.md", 100), undefined);
	cache.set("2026-11-17.md", 200, 500);
	assert.equal(cache.get("2026-11-17.md", 200), 500);
	assert.equal(wordCountCache().get("2026-11-17.md", 200), undefined);
});
