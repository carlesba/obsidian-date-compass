import { en } from "./en.ts";
import type { Translation, TranslationKey } from "./en.ts";
import { es } from "./es.ts";

export type { Translation, TranslationKey } from "./en.ts";

export const DEFAULT_LANGUAGE = "en";

export const TRANSLATIONS: Readonly<Record<string, Translation>> = {
	en,
	es,
};

export type Placeholders = Record<string, string | number>;

let active: Translation = en;

export function setLanguage(language: string): void {
	active = Object.prototype.hasOwnProperty.call(TRANSLATIONS, language) ? TRANSLATIONS[language] : en;
}

export function t(key: TranslationKey, placeholders?: Placeholders): string {
	const template = active[key] ?? en[key];
	if (!placeholders) return template;
	return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
		Object.prototype.hasOwnProperty.call(placeholders, name) ? String(placeholders[name]) : match,
	);
}

export function translatedLabels<Choice extends string>(keys: Record<Choice, TranslationKey>): Record<Choice, string> {
	const labels = {} as Record<Choice, string>;
	for (const choice of Object.keys(keys) as Choice[]) labels[choice] = t(keys[choice]);
	return labels;
}
