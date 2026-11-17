import { test } from "node:test";
import { strict as assert } from "node:assert";
import { DEFAULT_LANGUAGE, TRANSLATIONS, setLanguage, t } from "../src/i18n/index.ts";
import { en } from "../src/i18n/en.ts";

function placeholders(text: string): string[] {
	return (text.match(/\{\w+\}/g) ?? []).sort();
}

test("every locale has exactly the English keys, with the same placeholders", () => {
	for (const [language, translation] of Object.entries(TRANSLATIONS)) {
		assert.deepEqual(Object.keys(translation).sort(), Object.keys(en).sort(), `${language} keys differ from English`);
		for (const [key, text] of Object.entries(translation)) {
			assert.deepEqual(placeholders(text ?? ""), placeholders(en[key as keyof typeof en]), `${language}.${key} placeholders differ`);
		}
	}
});

test("Spanish is used when chosen, and unknown languages fall back to English", () => {
	try {
		setLanguage("es");
		assert.equal(t("cancel"), "Cancelar");
		setLanguage("fr");
		assert.equal(t("cancel"), "Cancel");
	} finally {
		setLanguage(DEFAULT_LANGUAGE);
	}
});
