import { test } from "node:test";
import { strict as assert } from "node:assert";
import { linkTarget, linktextOf, markdownLink, parentFolder, wikilink } from "../src/insertion/linkPath.ts";
import type { NoteLinkFacts } from "../src/insertion/linkPath.ts";

const missingAndSafe: NoteLinkFacts = { exists: false, shortestLinks: true, nameTaken: false, createdInItsFolder: true };

test("shortest when safe writes the name for a missing note only when the short link can only create it in its own folder", () => {
	assert.equal(linkTarget("shortestWhenSafe", () => missingAndSafe), "name");
	assert.equal(linkTarget("shortestWhenSafe", () => ({ ...missingAndSafe, nameTaken: true })), "obsidian");
	assert.equal(linkTarget("shortestWhenSafe", () => ({ ...missingAndSafe, createdInItsFolder: false })), "obsidian");
	assert.equal(linkTarget("shortestWhenSafe", () => ({ ...missingAndSafe, shortestLinks: false })), "obsidian");
	assert.equal(linkTarget("shortestWhenSafe", () => ({ ...missingAndSafe, exists: true })), "obsidian");
});

test("the forced choices ignore the vault", () => {
	const facts = () => assert.fail("forced choices never look at the vault");
	assert.equal(linkTarget("name", facts), "name");
	assert.equal(linkTarget("fullPath", facts), "fullPath");
});

test("links keep the alias unless it repeats the link text", () => {
	const note = { name: "2020-12-31", path: "on/2020-12-31.md" };
	assert.equal(wikilink(linktextOf("name", note), "Thu 31 Dec"), "[[2020-12-31|Thu 31 Dec]]");
	assert.equal(wikilink(linktextOf("fullPath", note), undefined), "[[on/2020-12-31]]");
	assert.equal(wikilink("2020-12-31", "2020-12-31"), "[[2020-12-31]]");
	assert.equal(markdownLink("Daily notes/2020-12-31", "Thu 31 Dec"), "[Thu 31 Dec](Daily%20notes/2020-12-31.md)");
});

test("the parent folder of a note at the vault root is empty", () => {
	assert.equal(parentFolder("2020-12-31.md"), "");
	assert.equal(parentFolder("on/2020/2020-12-31.md"), "on/2020");
});
