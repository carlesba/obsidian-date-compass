import { test } from "node:test";
import { strict as assert } from "node:assert";
import { addLanguage, canRemoveLanguage, languagesToAdd, removeLanguage } from "../src/settings/languageList.ts";

test("a newly added language goes last, and adding one twice changes nothing", () => {
	assert.deepEqual(addLanguage(["es"], "en"), ["es", "en"]);
	assert.deepEqual(addLanguage(["es", "en"], "en"), ["es", "en"]);
});

test("removing a language keeps the order of the others", () => {
	assert.deepEqual(removeLanguage(["es", "en"], "es"), ["en"]);
	assert.deepEqual(removeLanguage(["en", "es"], "es"), ["en"]);
});

test("the last language cannot be removed", () => {
	assert.equal(canRemoveLanguage(["en"]), false);
	assert.equal(canRemoveLanguage(["en", "es"]), true);
	assert.deepEqual(removeLanguage(["en"], "en"), ["en"]);
});

test("only the languages not yet enabled are offered", () => {
	assert.deepEqual(languagesToAdd(["es"]), ["en"]);
	assert.deepEqual(languagesToAdd(["es", "en"]), []);
});
