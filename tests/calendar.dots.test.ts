import { test } from "node:test";
import { strict as assert } from "node:assert";
import { countWords, openTaskCount, wordCountCache } from "../src/calendar/dots.ts";

test("words are counted across punctuation, numbers, accents and scripts without spaces", () => {
	assert.equal(countWords(""), 0);
	assert.equal(countWords("One two, three."), 3);
	assert.equal(countWords("A well-known rule: don't count 3.5 twice"), 7);
	assert.equal(countWords("Mañana será otro día"), 4);
	assert.equal(countWords("- [ ] call the bank\n- [x] done"), 5);
	assert.equal(countWords("日本語 text"), 4);
	assert.equal(countWords("--- ... !!!"), 0);
});

test("a note counts its unchecked tasks", () => {
	assert.equal(openTaskCount(undefined), 0);
	assert.equal(openTaskCount([]), 0);
	assert.equal(openTaskCount([{}, { task: undefined }]), 0);
	assert.equal(openTaskCount([{ task: "x" }, { task: "-" }]), 0);
	assert.equal(openTaskCount([{ task: "x" }, { task: " " }, { task: " " }]), 2);
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
